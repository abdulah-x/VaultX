#!/usr/bin/env python3
"""
P&L (Profit & Loss) API Endpoints
Portfolio performance analytics and profit/loss calculations
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime, date, timedelta
import sys
from pathlib import Path

# Add database to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import func
from database import SessionLocal, User, Asset, Holding, Trade, CurrentPrice
from core.dependencies import get_db, get_current_active_user
from core.errors import DatabaseError, ValidationError, NotFoundError
from pydantic import BaseModel

router = APIRouter()


def _stringify_decimals(obj):
    """Recursively convert Decimal values to strings for JSON output.

    Monetary columns are stored as DECIMAL(20,8); casting them to float on the
    way out (float(value)) silently loses precision (e.g. 0.1+0.2 drift). Emitting
    them as strings preserves the exact stored value. Applied to the whole
    response at the end so internal math/sorting still runs on real Decimals.
    """
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _stringify_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_stringify_decimals(v) for v in obj]
    return obj

# Pydantic models
class AssetPnL(BaseModel):
    symbol: str
    quantity: Decimal
    average_buy_price: Decimal
    current_price: Decimal
    total_cost: Decimal
    current_value: Decimal
    unrealized_pnl: Decimal
    unrealized_pnl_percentage: Decimal
    realized_pnl: Decimal
    total_pnl: Decimal

class PnLSummary(BaseModel):
    total_portfolio_value: Decimal
    total_invested: Decimal
    total_unrealized_pnl: Decimal
    total_realized_pnl: Decimal
    total_pnl: Decimal
    total_pnl_percentage: Decimal
    best_performer: Optional[Dict[str, Any]]
    worst_performer: Optional[Dict[str, Any]]

@router.get("/pnl", response_model=Dict[str, Any])
async def get_portfolio_pnl(
    current_user: User = Depends(get_current_active_user),
    include_zero: bool = Query(False, description="Include assets with zero holdings"),
    db = Depends(get_db)
):
    """
    Get comprehensive Profit & Loss analysis for the portfolio
    
    Returns:
    - Per-asset P&L breakdown
    - Portfolio-wide P&L summary
    - Best and worst performing assets
    - Realized vs unrealized gains/losses
    """
    try:
        # Get all holdings with current prices
        holdings_query = (
            db.query(Holding, Asset.symbol, CurrentPrice.price_usd)
            .join(Asset, Holding.asset_id == Asset.id)
            .outerjoin(CurrentPrice, Asset.id == CurrentPrice.asset_id)
            .filter(Holding.user_id == current_user.id)
        )
        
        if not include_zero:
            holdings_query = holdings_query.filter(Holding.total_quantity > 0)
        
        holdings_data = holdings_query.all()
        
        if not holdings_data:
            return {
                "success": True,
                "user_id": current_user.id,
                "timestamp": datetime.utcnow().isoformat(),
                "summary": {
                    "total_portfolio_value": 0,
                    "total_invested": 0,
                    "total_unrealized_pnl": 0,
                    "total_realized_pnl": 0,
                    "total_pnl": 0,
                    "total_pnl_percentage": 0,
                    "asset_count": 0
                },
                "assets": []
            }
        
        # Pre-aggregate realized P&L per base asset in a single query. This
        # replaces a per-holding query (N+1) and the imprecise symbol LIKE match
        # (which caught unrelated pairs like BTCUP/BTCDOWN for "BTC").
        realized_rows = (
            db.query(Trade.base_asset_id, func.sum(Trade.realized_pnl_usd))
            .filter(
                Trade.user_id == current_user.id,
                Trade.realized_pnl_usd.isnot(None),
            )
            .group_by(Trade.base_asset_id)
            .all()
        )
        realized_by_asset = {aid: total for aid, total in realized_rows}

        # Calculate P&L for each asset
        asset_pnl_list = []
        total_portfolio_value = Decimal('0')
        total_invested = Decimal('0')
        total_unrealized_pnl = Decimal('0')
        total_realized_pnl = Decimal('0')

        for holding, symbol, current_price in holdings_data:
            if current_price is None:
                current_price = Decimal('0')
            else:
                current_price = Decimal(str(current_price))

            quantity = holding.total_quantity
            avg_buy_price = holding.average_cost_usd
            total_cost = holding.total_cost_usd
            current_value = quantity * current_price

            # Unrealized P&L
            unrealized_pnl = current_value - total_cost
            unrealized_pnl_pct = (unrealized_pnl / total_cost * 100) if total_cost > 0 else Decimal('0')

            # Realized P&L from the pre-aggregated map (keyed by base asset id)
            realized_raw = realized_by_asset.get(holding.asset_id)
            realized_pnl = Decimal(str(realized_raw)) if realized_raw else Decimal('0')

            # Total P&L
            total_pnl = unrealized_pnl + realized_pnl
            
            asset_pnl = {
                "symbol": symbol,
                "quantity": quantity,
                "average_buy_price": avg_buy_price,
                "current_price": current_price,
                "total_cost": total_cost,
                "current_value": current_value,
                "unrealized_pnl": unrealized_pnl,
                "unrealized_pnl_percentage": unrealized_pnl_pct,
                "realized_pnl": realized_pnl,
                "total_pnl": total_pnl,
                "total_pnl_percentage": (total_pnl / total_cost * 100) if total_cost > 0 else Decimal('0')
            }
            
            asset_pnl_list.append(asset_pnl)
            
            # Add to totals
            total_portfolio_value += current_value
            total_invested += total_cost
            total_unrealized_pnl += unrealized_pnl
            total_realized_pnl += realized_pnl
        
        # Calculate total P&L
        total_pnl = total_unrealized_pnl + total_realized_pnl
        total_pnl_percentage = (total_pnl / total_invested * 100) if total_invested > 0 else Decimal('0')
        
        # Find best and worst performers
        best_performer = None
        worst_performer = None
        
        if asset_pnl_list:
            # Sort by total P&L percentage
            sorted_assets = sorted(asset_pnl_list, key=lambda x: x['total_pnl_percentage'], reverse=True)
            best_performer = sorted_assets[0] if sorted_assets[0]['total_pnl_percentage'] > 0 else None
            worst_performer = sorted_assets[-1] if sorted_assets[-1]['total_pnl_percentage'] < 0 else None
        
        return _stringify_decimals({
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_portfolio_value": total_portfolio_value,
                "total_invested": total_invested,
                "total_unrealized_pnl": total_unrealized_pnl,
                "total_realized_pnl": total_realized_pnl,
                "total_pnl": total_pnl,
                "total_pnl_percentage": total_pnl_percentage,
                "asset_count": len(asset_pnl_list),
                "profitable_assets": len([a for a in asset_pnl_list if a['total_pnl'] > 0]),
                "losing_assets": len([a for a in asset_pnl_list if a['total_pnl'] < 0])
            },
            "performance": {
                "best_performer": best_performer,
                "worst_performer": worst_performer
            },
            "assets": sorted(asset_pnl_list, key=lambda x: x['current_value'], reverse=True)
        })

    except Exception as e:
        raise DatabaseError(f"Error calculating P&L: {str(e)}")

@router.get("/pnl/summary", response_model=Dict[str, Any])
async def get_pnl_summary(
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Get P&L summary overview (simplified version of main P&L endpoint)
    """
    try:
        # Get all user's holdings
        holdings = db.query(Holding).filter(Holding.user_id == current_user.id).all()

        if not holdings:
            return {
                "success": True,
                "user_id": current_user.id,
                "timestamp": datetime.utcnow().isoformat(),
                "summary": {
                    "total_portfolio_value": 0.0,
                    "total_invested": 0.0,
                    "total_unrealized_pnl": 0.0,
                    "total_realized_pnl": 0.0,
                    "total_pnl": 0.0,
                    "total_pnl_percentage": 0.0,
                    "asset_count": 0,
                    "profitable_assets": 0,
                    "losing_assets": 0
                },
                "performance": {
                    "best_performer": None,
                    "worst_performer": None
                }
            }
        
        # Simple summary calculation using real Holding columns. Current value
        # falls back to cost basis when a live price hasn't been recorded yet.
        total_cost = sum((h.total_cost_usd or Decimal('0')) for h in holdings)
        total_value = sum(
            (h.current_value_usd if h.current_value_usd is not None else (h.total_cost_usd or Decimal('0')))
            for h in holdings
        )
        total_unrealized = total_value - total_cost
        total_pnl_pct = (total_unrealized / total_cost * 100) if total_cost > 0 else Decimal('0')

        profitable = sum(1 for h in holdings if (h.unrealized_pnl_usd or 0) > 0)
        losing = sum(1 for h in holdings if (h.unrealized_pnl_usd or 0) < 0)

        summary_data = {
            "total_portfolio_value": total_value,
            "total_invested": total_cost,
            "total_unrealized_pnl": total_unrealized,
            "total_realized_pnl": Decimal('0'),
            "total_pnl": total_unrealized,
            "total_pnl_percentage": total_pnl_pct,
            "asset_count": len(holdings),
            "profitable_assets": profitable,
            "losing_assets": losing
        }

        # Return the summary
        return _stringify_decimals({
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "summary": summary_data,
            "performance": {
                "best_performer": None,
                "worst_performer": None
            }
        })

    except Exception as e:
        raise DatabaseError(f"Error getting P&L summary: {str(e)}")

@router.get("/pnl/details", response_model=Dict[str, Any])
async def get_pnl_details(
    current_user: User = Depends(get_current_active_user),
    include_zero: bool = Query(False, description="Include assets with zero holdings"),
    db = Depends(get_db)
):
    """
    Get detailed P&L breakdown with all asset information
    """
    try:
        # Get the main P&L data with all details
        full_pnl = await get_portfolio_pnl(current_user, include_zero, db)
        
        # Return detailed version with additional breakdown
        return {
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "summary": full_pnl["summary"],
            "performance": full_pnl["performance"],
            "assets": full_pnl["assets"],
            "breakdown": {
                "by_profit_loss": {
                    "profitable": [a for a in full_pnl["assets"] if a['total_pnl'] > 0],
                    "breakeven": [a for a in full_pnl["assets"] if a['total_pnl'] == 0],
                    "losing": [a for a in full_pnl["assets"] if a['total_pnl'] < 0]
                },
                "by_allocation": {
                    "top_holdings": sorted(full_pnl["assets"], key=lambda x: x['current_value'], reverse=True)[:5],
                    "smallest_holdings": sorted(full_pnl["assets"], key=lambda x: x['current_value'])[:5]
                }
            }
        }
        
    except Exception as e:
        raise DatabaseError(f"Error getting P&L details: {str(e)}")

@router.get("/pnl/realized", response_model=Dict[str, Any])
async def get_realized_pnl(
    current_user: User = Depends(get_current_active_user),
    symbol: Optional[str] = Query(None, description="Filter by specific symbol"),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    db = Depends(get_db)
):
    """
    Get realized P&L from completed trades
    """
    try:
        # Build query for realized trades
        query = db.query(Trade).filter(
            Trade.user_id == current_user.id,
            Trade.realized_pnl_usd.isnot(None),
            Trade.executed_at >= datetime.utcnow() - timedelta(days=days)
        )
        
        if symbol:
            # Resolve the asset and match on base_asset_id for precision.
            asset = db.query(Asset).filter(Asset.symbol == symbol.upper()).first()
            if asset:
                query = query.filter(Trade.base_asset_id == asset.id)
            else:
                query = query.filter(Trade.symbol == symbol.upper())

        realized_trades = query.order_by(Trade.executed_at.desc()).all()
        
        if not realized_trades:
            return {
                "success": True,
                "user_id": current_user.id,
                "timestamp": datetime.utcnow().isoformat(),
                "period_days": days,
                "symbol_filter": symbol,
                "summary": {
                    "total_realized_pnl": 0.0,
                    "profitable_trades": 0,
                    "losing_trades": 0,
                    "total_trades": 0,
                    "win_rate": 0.0,
                    "average_profit": 0.0,
                    "average_loss": 0.0
                },
                "trades": []
            }
        
        # Calculate statistics
        total_realized = sum(trade.realized_pnl_usd for trade in realized_trades if trade.realized_pnl_usd)
        profitable_trades = [t for t in realized_trades if t.realized_pnl_usd and t.realized_pnl_usd > 0]
        losing_trades = [t for t in realized_trades if t.realized_pnl_usd and t.realized_pnl_usd < 0]
        
        win_rate = (len(profitable_trades) / len(realized_trades) * 100) if realized_trades else 0
        avg_profit = sum(t.realized_pnl_usd for t in profitable_trades) / len(profitable_trades) if profitable_trades else 0
        avg_loss = sum(t.realized_pnl_usd for t in losing_trades) / len(losing_trades) if losing_trades else 0
        
        # Format trade data
        trades_data = []
        for trade in realized_trades:
            trades_data.append({
                "id": trade.id,
                "symbol": trade.symbol,
                "side": trade.side,
                "quantity": float(trade.quantity),
                "price": float(trade.price),
                "realized_pnl": float(trade.realized_pnl_usd) if trade.realized_pnl_usd else 0.0,
                "executed_at": trade.executed_at.isoformat(),
                "commission": float(trade.commission) if trade.commission else 0.0,
                "commission_asset": trade.commission_asset
            })
        
        return {
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "period_days": days,
            "symbol_filter": symbol,
            "summary": {
                "total_realized_pnl": float(total_realized),
                "profitable_trades": len(profitable_trades),
                "losing_trades": len(losing_trades),
                "total_trades": len(realized_trades),
                "win_rate": round(win_rate, 2),
                "average_profit": round(float(avg_profit), 2),
                "average_loss": round(float(avg_loss), 2)
            },
            "trades": trades_data
        }
        
    except Exception as e:
        raise DatabaseError(f"Error getting realized P&L: {str(e)}")

@router.get("/pnl/history", response_model=Dict[str, Any])
async def get_pnl_history(
    current_user: User = Depends(get_current_active_user),
    days: int = Query(30, ge=1, le=365, description="Number of days for historical analysis"),
    db = Depends(get_db)
):
    """
    Get historical P&L performance over time
    
    Returns daily P&L snapshots for the specified period
    """
    try:
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days)
        
        # Get all trades in the period for realized P&L
        trades = db.query(Trade).filter(
            Trade.user_id == current_user.id,
            Trade.executed_at >= start_date,
            Trade.realized_pnl_usd.isnot(None)
        ).order_by(Trade.executed_at).all()
        
        # Group trades by date and calculate cumulative realized P&L
        daily_realized_pnl = {}
        cumulative_realized = Decimal('0')
        
        for trade in trades:
            trade_date = trade.executed_at.date()
            if trade_date not in daily_realized_pnl:
                daily_realized_pnl[trade_date] = Decimal('0')
            
            daily_realized_pnl[trade_date] += trade.realized_pnl_usd
            cumulative_realized += trade.realized_pnl_usd
        
        # Generate daily history
        history = []
        current_date = start_date
        
        while current_date <= end_date:
            daily_realized = daily_realized_pnl.get(current_date, Decimal('0'))
            
            history.append({
                "date": current_date.isoformat(),
                "daily_realized_pnl": float(daily_realized),
                "cumulative_realized_pnl": float(cumulative_realized) if current_date in daily_realized_pnl else 0
            })
            
            current_date += timedelta(days=1)
        
        # Calculate period statistics
        total_realized = sum(daily_realized_pnl.values())
        trading_days = len([day for day in daily_realized_pnl.values() if day != 0])
        
        return {
            "success": True,
            "user_id": current_user.id,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "statistics": {
                "total_realized_pnl": float(total_realized),
                "trading_days": trading_days,
                "average_daily_pnl": float(total_realized / max(trading_days, 1)),
                "best_day": float(max(daily_realized_pnl.values())) if daily_realized_pnl else 0,
                "worst_day": float(min(daily_realized_pnl.values())) if daily_realized_pnl else 0
            },
            "history": history
        }
        
    except Exception as e:
        raise DatabaseError(f"Error fetching P&L history: {str(e)}")

@router.get("/pnl/unrealized", response_model=Dict[str, Any])
async def get_unrealized_pnl(
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Get unrealized P&L from current holdings
    
    This shows potential profits/losses from current positions
    based on current market prices vs cost basis
    """
    try:
        # Get current holdings with unrealized P&L
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
                "success": True,
                "user_id": current_user.id,
                "message": "No current holdings with unrealized P&L",
                "summary": {
                    "total_unrealized_pnl_usd": 0,
                    "total_current_value_usd": 0,
                    "total_cost_basis_usd": 0,
                    "total_unrealized_pnl_percentage": 0,
                    "holdings_count": 0
                },
                "holdings": []
            }
        
        # Calculate unrealized P&L for each holding
        total_unrealized = Decimal('0')
        total_current_value = Decimal('0')
        total_cost_basis = Decimal('0')
        holdings_list = []
        
        for holding, asset, current_price in holdings_data:
            # Current market value
            price_usd = current_price.price_usd if current_price else Decimal('0')
            current_value = holding.total_quantity * price_usd if price_usd > 0 else Decimal('0')
            cost_basis = holding.total_cost_usd
            
            # Unrealized P&L calculation
            unrealized_pnl = current_value - cost_basis if current_value > 0 else Decimal('0')
            unrealized_pnl_pct = (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else Decimal('0')
            
            holdings_list.append({
                "asset_symbol": asset.symbol,
                "asset_name": asset.name,
                "quantity": float(holding.total_quantity),
                "cost_basis_usd": float(cost_basis),
                "current_price_usd": float(price_usd) if price_usd else None,
                "current_value_usd": float(current_value) if current_value else None,
                "unrealized_pnl_usd": float(unrealized_pnl),
                "unrealized_pnl_percentage": float(unrealized_pnl_pct),
                "is_profitable": float(unrealized_pnl) > 0
            })
            
            total_unrealized += unrealized_pnl
            total_current_value += current_value
            total_cost_basis += cost_basis
        
        # Overall unrealized P&L percentage
        total_unrealized_pct = (total_unrealized / total_cost_basis * 100) if total_cost_basis > 0 else Decimal('0')
        
        # Count profitable vs losing positions
        profitable_holdings = [h for h in holdings_list if h["is_profitable"]]
        losing_holdings = [h for h in holdings_list if not h["is_profitable"]]
        
        return {
            "success": True,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_unrealized_pnl_usd": float(total_unrealized),
                "total_current_value_usd": float(total_current_value),
                "total_cost_basis_usd": float(total_cost_basis),
                "total_unrealized_pnl_percentage": float(total_unrealized_pct),
                "holdings_count": len(holdings_list),
                "profitable_holdings": len(profitable_holdings),
                "losing_holdings": len(losing_holdings),
                "win_rate": (len(profitable_holdings) / len(holdings_list) * 100) if holdings_list else 0
            },
            "holdings": holdings_list
        }
        
    except Exception as e:
        raise DatabaseError(f"Error fetching unrealized P&L: {str(e)}")

@router.get("/pnl/{symbol}", response_model=Dict[str, Any])
async def get_asset_pnl(
    symbol: str,
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Get detailed P&L analysis for a specific asset
    """
    try:
        # Get asset info
        asset = db.query(Asset).filter(Asset.symbol == symbol.upper()).first()
        if not asset:
            raise NotFoundError(f"Asset {symbol} not found")
        
        # Get holding
        holding = db.query(Holding).filter(
            Holding.user_id == current_user.id,
            Holding.asset_id == asset.id
        ).first()
        
        if not holding:
            return {
                "success": True,
                "symbol": symbol.upper(),
                "user_id": current_user.id,
                "message": "No holdings found for this asset",
                "pnl": {
                    "quantity": 0,
                    "total_cost": 0,
                    "current_value": 0,
                    "unrealized_pnl": 0,
                    "realized_pnl": 0,
                    "total_pnl": 0
                }
            }
        
        # Get current price
        current_price_obj = db.query(CurrentPrice).filter(CurrentPrice.asset_id == asset.id).first()
        current_price = Decimal(str(current_price_obj.price_usd)) if current_price_obj else Decimal('0')
        
        # Get all trades for this asset (match on the base asset, not a symbol
        # prefix, so "BTC" doesn't also pull in BTCUP/BTCDOWN pairs).
        trades = db.query(Trade).filter(
            Trade.user_id == current_user.id,
            Trade.base_asset_id == asset.id
        ).order_by(Trade.executed_at).all()
        
        # Calculate detailed P&L
        quantity = holding.total_quantity
        avg_buy_price = holding.average_cost_usd
        total_cost = holding.total_cost_usd
        current_value = quantity * current_price
        unrealized_pnl = current_value - total_cost
        
        # Realized P&L from trades
        realized_pnl = sum(trade.realized_pnl_usd for trade in trades if trade.realized_pnl_usd)
        realized_pnl = Decimal(str(realized_pnl)) if realized_pnl else Decimal('0')
        
        total_pnl = unrealized_pnl + realized_pnl
        
        # Trade breakdown
        buy_trades = [t for t in trades if t.side == 'BUY']
        sell_trades = [t for t in trades if t.side == 'SELL']
        
        total_bought = sum(t.quantity for t in buy_trades)
        total_sold = sum(t.quantity for t in sell_trades)
        total_buy_cost = sum(t.quote_quantity for t in buy_trades)
        total_sell_revenue = sum(t.quote_quantity for t in sell_trades)
        
        return {
            "success": True,
            "symbol": symbol.upper(),
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat(),
            "current_holding": {
                "quantity": float(quantity),
                "average_price": float(avg_buy_price),
                "current_price": float(current_price),
                "total_cost": float(total_cost),
                "current_value": float(current_value)
            },
            "pnl": {
                "unrealized_pnl": float(unrealized_pnl),
                "unrealized_pnl_percentage": float((unrealized_pnl / total_cost * 100) if total_cost > 0 else 0),
                "realized_pnl": float(realized_pnl),
                "total_pnl": float(total_pnl),
                "total_pnl_percentage": float((total_pnl / total_cost * 100) if total_cost > 0 else 0)
            },
            "trading_summary": {
                "total_trades": len(trades),
                "buy_trades": len(buy_trades),
                "sell_trades": len(sell_trades),
                "total_bought": float(total_bought),
                "total_sold": float(total_sold),
                "total_buy_cost": float(total_buy_cost),
                "total_sell_revenue": float(total_sell_revenue),
                "net_position": float(total_bought - total_sold)
            }
        }
        
    except (DatabaseError, NotFoundError):
        raise
    except Exception as e:
        raise DatabaseError(f"Error calculating P&L for {symbol}: {str(e)}")

@router.get("/pnl/realized-summary", response_model=Dict[str, Any])
async def get_realized_pnl_summary(
    current_user: User = Depends(get_current_active_user),
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db = Depends(get_db)
):
    """
    Get realized P&L from completed trades
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get trades with realized P&L
        trades = db.query(Trade).filter(
            Trade.user_id == current_user.id,
            Trade.executed_at >= start_date,
            Trade.executed_at <= end_date,
            Trade.realized_pnl_usd.isnot(None)
        ).order_by(Trade.executed_at.desc()).all()
        
        if not trades:
            return {
                "success": True,
                "user_id": current_user.id,
                "period_days": days,
                "summary": {
                    "total_realized_pnl": 0,
                    "profitable_trades": 0,
                    "losing_trades": 0,
                    "win_rate": 0,
                    "average_profit": 0,
                    "average_loss": 0
                },
                "trades": []
            }
        
        # Calculate statistics
        total_realized = sum(trade.realized_pnl_usd for trade in trades)
        profitable_trades = [t for t in trades if t.realized_pnl_usd > 0]
        losing_trades = [t for t in trades if t.realized_pnl_usd < 0]
        
        win_rate = len(profitable_trades) / len(trades) * 100 if trades else 0
        avg_profit = sum(t.realized_pnl_usd for t in profitable_trades) / len(profitable_trades) if profitable_trades else 0
        avg_loss = sum(t.realized_pnl_usd for t in losing_trades) / len(losing_trades) if losing_trades else 0
        
        # Format trades
        trades_list = []
        for trade in trades:
            trades_list.append({
                "id": trade.id,
                "symbol": trade.symbol,
                "side": trade.side,
                "quantity": float(trade.quantity),
                "price": float(trade.price),
                "realized_pnl": float(trade.realized_pnl_usd),
                "realized_pnl_percentage": float(trade.realized_pnl_percentage) if trade.realized_pnl_percentage else None,
                "executed_at": trade.executed_at.isoformat()
            })
        
        return {
            "success": True,
            "user_id": current_user.id,
            "period_days": days,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "summary": {
                "total_realized_pnl": float(total_realized),
                "total_trades": len(trades),
                "profitable_trades": len(profitable_trades),
                "losing_trades": len(losing_trades),
                "win_rate": round(win_rate, 2),
                "average_profit": float(avg_profit),
                "average_loss": float(avg_loss),
                "profit_loss_ratio": abs(avg_profit / avg_loss) if avg_loss != 0 else 0
            },
            "trades": trades_list
        }
        
    except Exception as e:
        raise DatabaseError(f"Error fetching realized P&L: {str(e)}")