#!/usr/bin/env python3
"""
One-off historical price backfill for the MPT optimizer (Phase 7).

The live pipeline (Phase 6) only started collecting ticks recently, and the
optimizer needs several months of daily closes to compute a meaningful
covariance matrix. Binance *testnet* only retains ~43 days of kline history —
not enough — so this script sources ~90 days of real daily closes from Binance
*mainnet's public, unauthenticated* market-data endpoint (no API key needed for
public klines) and writes them into the same `price_history` hypertable the
live pipeline feeds.

Idempotent: for each asset it skips calendar days that already have a
price_history row, so re-running never duplicates and never clobbers live ticks.

Run it once (inside the backend container):
    docker compose exec backend python backfill_price_history.py
"""
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal

# Add app directory to path (same pattern as seed_portfolio_data.py).
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from binance.client import Client
from sqlalchemy import insert

from database.connection import SessionLocal
from database.models import Asset, Holding, PriceHistory

# Symbols to backfill: every base currency held by any user, plus a default
# watchlist so a fresh DB still has something to optimize against.
DEFAULT_WATCHLIST = ["BTC", "ETH", "SOL", "BNB"]
LOOKBACK = "90 days ago UTC"


def _get_backfill_symbols(db) -> list[str]:
    """Distinct held base symbols (excluding USDT) plus the default watchlist."""
    held = (
        db.query(Asset.symbol)
        .join(Holding, Holding.asset_id == Asset.id)
        .filter(Holding.total_quantity > 0)
        .distinct()
        .all()
    )
    held_symbols = {symbol.upper() for (symbol,) in held if symbol.upper() != "USDT"}
    return sorted(held_symbols | set(DEFAULT_WATCHLIST))


def _existing_dates(db, asset_id: int) -> set:
    """Calendar dates that already have a price_history row for this asset."""
    rows = db.query(PriceHistory.timestamp).filter(PriceHistory.asset_id == asset_id).all()
    return {ts.date() for (ts,) in rows}


def main() -> None:
    # Public mainnet client — no keys needed for historical klines. Deliberately
    # NOT the testnet BinanceClientManager (testnet only keeps ~43 days).
    client = Client()

    db = SessionLocal()
    total_inserted = 0
    try:
        symbols = _get_backfill_symbols(db)
        print(f"📊 Backfilling {len(symbols)} symbols: {', '.join(symbols)}")

        # Map base symbol -> asset_id (create nothing; skip symbols with no asset row).
        asset_map = {symbol: asset_id for asset_id, symbol in db.query(Asset.id, Asset.symbol).all()}

        for base in symbols:
            asset_id = asset_map.get(base)
            if asset_id is None:
                print(f"  ⚠️  {base}: no matching asset row, skipping")
                continue

            pair = f"{base}USDT"
            try:
                klines = client.get_historical_klines(pair, Client.KLINE_INTERVAL_1DAY, LOOKBACK)
            except Exception as e:
                print(f"  ⚠️  {pair}: kline fetch failed ({e}), skipping")
                continue

            already = _existing_dates(db, asset_id)
            new_rows = []
            for k in klines:
                # kline: [open_time, open, high, low, close, volume, close_time, ...]
                close_time = datetime.fromtimestamp(k[6] / 1000, tz=timezone.utc)
                if close_time.date() in already:
                    continue
                new_rows.append(
                    {"asset_id": asset_id, "price_usd": Decimal(str(k[4])), "timestamp": close_time}
                )

            if new_rows:
                db.execute(insert(PriceHistory), new_rows)
                db.commit()
                total_inserted += len(new_rows)
            print(f"  ✅ {pair}: {len(new_rows)} new daily closes ({len(klines)} fetched)")

        print(f"\n🎉 Done — inserted {total_inserted} price_history rows.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
