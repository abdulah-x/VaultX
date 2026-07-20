#!/usr/bin/env python3
"""
Portfolio API Endpoints
Summary of holdings and portfolio overview
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path

# Add database to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import func
from database import SessionLocal, User, Asset, Holding, CurrentPrice, Trade, PriceHistory
from core.dependencies import get_db, get_current_active_user, get_optional_current_user
from core.errors import NotFoundError, ValidationError, DatabaseError
from core.decimal_utils import stringify_decimals
from pydantic import BaseModel

router = APIRouter()

# Pydantic models for responses
class AssetHolding(BaseModel):
    asset_symbol: str
    asset_name: str
    total_quantity: Decimal
    available_quantity: Decimal
    locked_quantity: Decimal
    average_cost_usd: Decimal
    current_price_usd: Optional[Decimal]
    current_value_usd: Optional[Decimal]
    unrealized_pnl_usd: Optional[Decimal]
    unrealized_pnl_percentage: Optional[Decimal]
    portfolio_percentage: Optional[Decimal]

class PortfolioSummary(BaseModel):
    user_id: int
    total_portfolio_value_usd: Decimal
    total_cost_usd: Decimal
    total_unrealized_pnl_usd: Decimal
    total_unrealized_pnl_percentage: Decimal
    asset_count: int
    last_updated: datetime
    holdings: List[AssetHolding]

@router.get("/portfolio", response_model=Dict[str, Any])
async def get_portfolio_summary(
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Get portfolio summary with all holdings
    
    Returns:
    - Total portfolio value
    - Individual asset holdings
    - P&L calculations
    - Portfolio allocation percentages
    """
    try:
        # Get user holdings with asset and price information
        holdings_query = (
            db.query(Holding, Asset, CurrentPrice)
            .join(Asset, Holding.asset_id == Asset.id)
            .outerjoin(CurrentPrice, Asset.id == CurrentPrice.asset_id)
            .filter(Holding.user_id == current_user.id)
            .filter(Holding.total_quantity > 0)
        )
        
        holdings_data = holdings_query.all()
        
        if not holdings_data:
            return {
                "message": "No holdings found for user",
                "user_id": current_user.id,
                "portfolio_summary": {
                    "total_portfolio_value_usd": 0,
                    "total_cost_usd": 0,
                    "total_unrealized_pnl_usd": 0,
                    "total_unrealized_pnl_percentage": 0,
                    "asset_count": 0,
                    "holdings": []
                }
            }
        
        # Calculate portfolio metrics
        total_value = Decimal('0')
        total_cost = Decimal('0')
        holdings_list = []
        
        for holding, asset, current_price in holdings_data:
            # Current price (use stored price or fetch live price)
            price_usd = current_price.price_usd if current_price else Decimal('0')
            current_value = holding.total_quantity * price_usd if price_usd > 0 else Decimal('0')
            
            # P&L calculations
            unrealized_pnl = current_value - holding.total_cost_usd if current_value > 0 else Decimal('0')
            unrealized_pnl_pct = (unrealized_pnl / holding.total_cost_usd * 100) if holding.total_cost_usd > 0 else Decimal('0')
            
            holdings_list.append({
                "asset_symbol": asset.symbol,
                "asset_name": asset.name,
                "total_quantity": holding.total_quantity,
                "available_quantity": holding.available_quantity,
                "locked_quantity": holding.locked_quantity,
                "average_cost_usd": holding.average_cost_usd,
                "current_price_usd": price_usd if price_usd else None,
                "current_value_usd": current_value if current_value else None,
                "unrealized_pnl_usd": unrealized_pnl,
                "unrealized_pnl_percentage": unrealized_pnl_pct,
                "portfolio_percentage": Decimal('0')  # Will calculate after total
            })

            total_value += current_value
            total_cost += holding.total_cost_usd

        # Calculate portfolio percentages
        for holding in holdings_list:
            if total_value > 0 and holding["current_value_usd"]:
                holding["portfolio_percentage"] = (holding["current_value_usd"] / total_value) * 100

        # Overall P&L
        total_pnl = total_value - total_cost
        total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else Decimal('0')

        return stringify_decimals({
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "portfolio_summary": {
                "total_portfolio_value_usd": total_value,
                "total_cost_usd": total_cost,
                "total_unrealized_pnl_usd": total_pnl,
                "total_unrealized_pnl_percentage": total_pnl_pct,
                "asset_count": len(holdings_list),
                "last_updated": datetime.utcnow().isoformat(),
                "holdings": holdings_list
            }
        })

    except Exception as e:
        raise DatabaseError(f"Error fetching portfolio: {str(e)}")

@router.get("/overview", response_model=Dict[str, Any])
async def get_portfolio_overview(
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Get condensed portfolio overview (just totals, no individual holdings)
    """
    try:
        # Query portfolio totals
        holdings = db.query(Holding).filter(
            Holding.user_id == current_user.id,
            Holding.total_quantity > 0
        ).all()
        
        if not holdings:
            return {
                "user_id": current_user.id,
                "total_value_usd": 0,
                "total_cost_usd": 0,
                "total_pnl_usd": 0,
                "total_pnl_percentage": 0,
                "asset_count": 0
            }
        
        total_value = sum(h.current_value_usd or Decimal('0') for h in holdings)
        total_cost = sum(h.total_cost_usd for h in holdings)
        total_pnl = total_value - total_cost
        total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else Decimal('0')

        return stringify_decimals({
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_value_usd": total_value,
                "total_cost_usd": total_cost,
                "total_pnl_usd": total_pnl,
                "total_pnl_percentage": total_pnl_pct,
                "asset_count": len(holdings)
            }
        })
        
    except Exception as e:
        raise DatabaseError(f"Error fetching portfolio summary: {str(e)}")

@router.get("/portfolio/summary", response_model=Dict[str, Any])
async def get_portfolio_summary_alias(
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Portfolio summary (alias to main portfolio endpoint)
    Returns the same data as /api/portfolio
    """
    return await get_portfolio_summary(current_user, db)

@router.get("/portfolio/holdings", response_model=Dict[str, Any])
async def get_portfolio_holdings(
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Get just the holdings data from portfolio
    """
    try:
        # Get full portfolio data
        portfolio_data = await get_portfolio_summary(current_user, db)
        
        # Extract just the holdings
        holdings = portfolio_data.get("portfolio_summary", {}).get("holdings", [])
        
        return {
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "holdings": holdings,
            "total_holdings": len(holdings)
        }
        
    except Exception as e:
        raise DatabaseError(f"Error fetching portfolio holdings: {str(e)}")

@router.get("/portfolio/performance", response_model=Dict[str, Any])
async def get_portfolio_performance(
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Get portfolio performance metrics
    """
    try:
        # Get full portfolio data
        portfolio_data = await get_portfolio_summary(current_user, db)
        portfolio_summary = portfolio_data.get("portfolio_summary", {})
        # total_unrealized_pnl_usd comes back as a string (stringify_decimals
        # applied in get_portfolio_summary) - parse for the numeric comparison.
        unrealized_pnl = Decimal(str(portfolio_summary.get("total_unrealized_pnl_usd", 0) or 0))

        # Extract performance metrics
        return {
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "performance": {
                "total_portfolio_value_usd": portfolio_summary.get("total_portfolio_value_usd", 0),
                "total_cost_usd": portfolio_summary.get("total_cost_usd", 0),
                "total_unrealized_pnl_usd": portfolio_summary.get("total_unrealized_pnl_usd", 0),
                "total_unrealized_pnl_percentage": portfolio_summary.get("total_unrealized_pnl_percentage", 0),
                "asset_count": portfolio_summary.get("asset_count", 0),
                "performance_summary": {
                    "is_profitable": unrealized_pnl > 0,
                    "performance_grade": "Positive" if unrealized_pnl > 0 else "Negative",
                    "last_updated": portfolio_summary.get("last_updated")
                }
            }
        }
        
    except Exception as e:
        raise DatabaseError(f"Error fetching portfolio performance: {str(e)}")

@router.get("/portfolio/kpis", response_model=Dict[str, Any])
async def get_portfolio_kpis(
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Header KPI strip for the portfolio dashboard — one call the frontend binds
    the whole top-of-page card row to.

    Returns:
    - portfolio_value_usd: current market value of held positions (qty x live price)
    - invested_usd: cost basis of those held positions
    - capital_gain: total gain (realized + unrealized) in USD and %, the
      unrealized/realized split, and the 24h ("today") change in USD and %.

    Definitions (crypto-appropriate; no IRR, no dividends):
    - unrealized = current value - cost basis of current holdings
    - realized   = sum of Trade.realized_pnl_usd across the user's closed/partial sells
    - total gain = unrealized + realized; percent is total gain / cost basis
    - today's change compares current value to the value of the SAME current
      holdings priced at their close ~24h ago (from the price_history hypertable),
      i.e. a pure price move on today's positions.
    """
    try:
        rows = (
            db.query(Holding, Asset, CurrentPrice)
            .join(Asset, Holding.asset_id == Asset.id)
            .outerjoin(CurrentPrice, Asset.id == CurrentPrice.asset_id)
            .filter(Holding.user_id == current_user.id)
            .filter(Holding.total_quantity > 0)
            .all()
        )

        total_value = Decimal('0')
        total_cost = Decimal('0')
        qty_by_asset: Dict[int, Decimal] = {}
        current_price_by_asset: Dict[int, Decimal] = {}

        for holding, asset, current_price in rows:
            price = current_price.price_usd if (current_price and current_price.price_usd is not None) else Decimal('0')
            qty = holding.total_quantity or Decimal('0')
            total_value += qty * price
            total_cost += holding.total_cost_usd or Decimal('0')
            qty_by_asset[asset.id] = qty
            current_price_by_asset[asset.id] = price

        unrealized = total_value - total_cost

        # Realized P&L across all of this user's sells (same source pnl.py uses).
        realized_raw = (
            db.query(func.coalesce(func.sum(Trade.realized_pnl_usd), 0))
            .filter(Trade.user_id == current_user.id, Trade.realized_pnl_usd.isnot(None))
            .scalar()
        )
        realized = Decimal(str(realized_raw)) if realized_raw is not None else Decimal('0')

        capital_gain_total = unrealized + realized
        capital_gain_pct = (capital_gain_total / total_cost * 100) if total_cost > 0 else Decimal('0')

        # Today's change: value of the SAME holdings priced ~24h ago, from
        # price_history (last close at or before the 24h cutoff, per asset).
        value_24h_ago = Decimal('0')
        asset_ids = list(qty_by_asset.keys())
        if asset_ids:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            prior_rows = (
                db.query(PriceHistory.asset_id, PriceHistory.price_usd)
                .filter(PriceHistory.asset_id.in_(asset_ids), PriceHistory.timestamp <= cutoff)
                .order_by(PriceHistory.asset_id, PriceHistory.timestamp.desc())
                .distinct(PriceHistory.asset_id)
                .all()
            )
            prior_price = {asset_id: price for asset_id, price in prior_rows}
            for asset_id, qty in qty_by_asset.items():
                # No 24h-ago history for this asset -> fall back to its current
                # price so it contributes 0 to the change rather than skewing it.
                price = prior_price.get(asset_id) or current_price_by_asset.get(asset_id) or Decimal('0')
                value_24h_ago += qty * price

        today_usd = (total_value - value_24h_ago) if value_24h_ago > 0 else Decimal('0')
        today_pct = (today_usd / value_24h_ago * 100) if value_24h_ago > 0 else Decimal('0')

        return stringify_decimals({
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "kpis": {
                "portfolio_value_usd": total_value,
                "invested_usd": total_cost,
                "capital_gain": {
                    "total_usd": capital_gain_total,
                    "total_percent": capital_gain_pct,
                    "unrealized_usd": unrealized,
                    "realized_usd": realized,
                    "today_usd": today_usd,
                    "today_percent": today_pct,
                },
            },
        })

    except Exception as e:
        raise DatabaseError(f"Error building portfolio KPIs: {str(e)}")