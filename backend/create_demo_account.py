#!/usr/bin/env python3
"""
Seed the shared read-only demo account behind "Try as guest".

Every guest session (POST /api/auth/guest) is issued a short-lived token
pointing at this one account, so the portfolio, analytics and exported reports
they see are the ones generated here — once — rather than per visitor.

Unlike seed_portfolio_data.py, this touches exactly one user and is idempotent:
re-running it tops up anything missing and leaves existing rows alone, so it is
safe to run on every deploy.

    docker compose exec backend python create_demo_account.py

The account is deliberately *unremarkable* apart from its email: the guest
restriction lives on the token, not on the row, so this stays a normal user that
happens to be the demo target.
"""

import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

# Add app directory to path (same bootstrap as the other top-level scripts).
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from core.auth import auth_manager
from core.config import settings
from database.connection import SessionLocal
from database.models import Asset, CurrentPrice, Holding, Trade, User

DEMO_USERNAME = "vaultx_demo"

# Reference prices, used only to fill in a CurrentPrice row that doesn't exist
# yet. When the live price pipeline is running it will already have written real
# values for these symbols, and we must not overwrite them with stale constants —
# a demo showing a frozen 2024 Bitcoin price looks broken.
FALLBACK_PRICES = {
    "BTC": Decimal("64000.00"),
    "ETH": Decimal("3100.00"),
    "BNB": Decimal("580.00"),
    "SOL": Decimal("145.00"),
    "ADA": Decimal("0.45"),
    "USDT": Decimal("1.00"),
}

ASSET_NAMES = {
    "BTC": "Bitcoin",
    "ETH": "Ethereum",
    "BNB": "Binance Coin",
    "SOL": "Solana",
    "ADA": "Cardano",
    "USDT": "Tether",
}

# The demo portfolio. Buys and sells are both included on purpose: without any
# closed positions the win-rate, realized-P&L, fee-breakdown and holding-time
# analytics would all render as empty, which is exactly what a guest came to see.
#
# Sells are kept inside the last ~30 days on purpose: /trades/analysis defaults
# to a 30-day window, so activity older than that would leave a guest looking at
# an empty win-rate/fee panel on their very first screen. The mix is 3 wins to 1
# loss rather than all green — a demo portfolio that never loses reads as fake.
#
# (symbol, [(qty, price, days_ago), ...] buys, [(qty, price, days_ago), ...] sells)
DEMO_ACTIVITY = [
    ("BTC", [(Decimal("0.25"), Decimal("52000"), 240),
             (Decimal("0.15"), Decimal("61000"), 120)],
            [(Decimal("0.10"), Decimal("68000"), 12)]),
    ("ETH", [(Decimal("3.0"), Decimal("2450"), 210),
             (Decimal("2.0"), Decimal("3300"), 90)],
            [(Decimal("1.5"), Decimal("3050"), 20)]),
    ("SOL", [(Decimal("40"), Decimal("98"), 180)],
            [(Decimal("15"), Decimal("172"), 28)]),
    ("BNB", [(Decimal("8"), Decimal("505"), 150)], []),
    ("ADA", [(Decimal("2500"), Decimal("0.62"), 200)],
            [(Decimal("1000"), Decimal("0.41"), 8)]),
]


def get_or_create_demo_user(db) -> User:
    user = db.query(User).filter(User.email == settings.demo_user_email).first()
    if user:
        print(f"✅ Demo user already exists: {user.email} (id={user.id})")
        return user

    user = User(
        username=DEMO_USERNAME,
        email=settings.demo_user_email,
        # Random and immediately discarded. Nobody signs in to this account with
        # a password — guests receive a token directly from /api/auth/guest — so
        # there is no credential here to leak or guess.
        hashed_password=auth_manager.get_password_hash(os.urandom(32).hex()),
        first_name="VaultX",
        last_name="Demo",
        is_active=True,
        is_verified=True,
        timezone="UTC",
        preferred_currency="USD",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"✅ Created demo user: {user.email} (id={user.id})")
    return user


def get_or_create_assets(db) -> dict:
    assets = {}
    for symbol, name in ASSET_NAMES.items():
        asset = db.query(Asset).filter(Asset.symbol == symbol).first()
        if not asset:
            asset = Asset(
                symbol=symbol,
                name=name,
                asset_type="cryptocurrency",
                is_base_currency=(symbol == "USDT"),
                is_active=True,
            )
            db.add(asset)
            db.flush()
            print(f"✅ Created asset {symbol}")
        assets[symbol] = asset

        # Only fill a gap — never clobber a price the live pipeline wrote.
        existing = db.query(CurrentPrice).filter(CurrentPrice.asset_id == asset.id).first()
        if not existing:
            db.add(CurrentPrice(asset_id=asset.id, price_usd=FALLBACK_PRICES[symbol]))
            print(f"   ↳ seeded fallback price for {symbol}")

    db.commit()
    return assets


def current_price(db, asset) -> Decimal:
    row = db.query(CurrentPrice).filter(CurrentPrice.asset_id == asset.id).first()
    return row.price_usd if row else FALLBACK_PRICES.get(asset.symbol, Decimal("0"))


def seed_activity(db, user: User, assets: dict) -> None:
    if db.query(Trade).filter(Trade.user_id == user.id).count() > 0:
        print("⚠️  Demo account already has trades — leaving them as they are.")
        return

    usdt = assets["USDT"]
    now = datetime.utcnow()
    trade_seq = 0

    for symbol, buys, sells in DEMO_ACTIVITY:
        asset = assets[symbol]

        bought_qty = sum((q for q, _, _ in buys), Decimal("0"))
        bought_cost = sum((q * p for q, p, _ in buys), Decimal("0"))
        avg_cost = bought_cost / bought_qty

        for qty, price, days_ago in buys:
            trade_seq += 1
            db.add(_trade(user, asset, usdt, "BUY", qty, price, now - timedelta(days=days_ago),
                          trade_seq, realized=None))

        sold_qty = Decimal("0")
        for qty, price, days_ago in sells:
            trade_seq += 1
            # Average-cost basis, matching how Holding.average_cost_usd is kept.
            realized = (price - avg_cost) * qty
            db.add(_trade(user, asset, usdt, "SELL", qty, price, now - timedelta(days=days_ago),
                          trade_seq, realized=realized))
            sold_qty += qty

        remaining = bought_qty - sold_qty
        if remaining <= 0:
            continue

        price_now = current_price(db, asset)
        total_cost = remaining * avg_cost
        value_now = remaining * price_now
        unrealized = value_now - total_cost

        db.add(Holding(
            user_id=user.id,
            asset_id=asset.id,
            total_quantity=remaining,
            available_quantity=remaining,
            locked_quantity=Decimal("0"),
            average_cost_usd=avg_cost,
            total_cost_usd=total_cost,
            current_price_usd=price_now,
            current_value_usd=value_now,
            unrealized_pnl_usd=unrealized,
            unrealized_pnl_percentage=(unrealized / total_cost * 100) if total_cost > 0 else Decimal("0"),
            realized_pnl_usd=sum(((p - avg_cost) * q for q, p, _ in sells), Decimal("0")),
            first_acquired_at=now - timedelta(days=max(d for _, _, d in buys)),
            last_transaction_at=now - timedelta(days=min(d for _, _, d in buys + sells)),
        ))
        print(f"✅ {symbol}: {remaining} held @ avg ${avg_cost:.2f}, "
              f"{len(buys)} buy(s) / {len(sells)} sell(s)")

    db.commit()


def _trade(user, base_asset, quote_asset, side, qty, price, executed_at, seq, realized):
    quote_qty = qty * price
    return Trade(
        user_id=user.id,
        binance_order_id=f"DEMO_ORDER_{seq}",
        binance_trade_id=f"DEMO_TRADE_{seq}",
        symbol=f"{base_asset.symbol}USDT",
        base_asset_id=base_asset.id,
        quote_asset_id=quote_asset.id,
        side=side,
        order_type="MARKET",
        quantity=qty,
        price=price,
        quote_quantity=quote_qty,
        commission=quote_qty * Decimal("0.001"),
        commission_asset="USDT",
        status="FILLED",
        realized_pnl_usd=realized,
        executed_at=executed_at,
        import_source="demo_seed",
    )


def main():
    db = SessionLocal()
    try:
        print(f"\n🌱 Seeding demo account ({settings.demo_user_email})\n")
        user = get_or_create_demo_user(db)
        assets = get_or_create_assets(db)
        seed_activity(db, user, assets)
        print("\n✅ Demo account ready. Guests can now POST /api/auth/guest.\n")
    except Exception as e:
        print(f"❌ Error seeding demo account: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
