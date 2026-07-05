#!/usr/bin/env python3
"""
Trades API Endpoints
Trade history and transaction management
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime, date
import sys
from pathlib import Path

# Add database to path
sys.path.append(str(Path(__file__).parent.parent))

from database import SessionLocal, User, Asset, Trade, Transaction
from core.dependencies import get_db, get_current_active_user
from core.errors import NotFoundError, ValidationError, DatabaseError
from pydantic import BaseModel

router = APIRouter()

# Pydantic models
class TradeResponse(BaseModel):
    id: int
    binance_order_id: Optional[str]
    binance_trade_id: Optional[str]
    symbol: str
    base_asset: str
    quote_asset: str
    side: str  # BUY/SELL
    order_type: str
    quantity: Decimal
    price: Decimal
    quote_quantity: Decimal
    commission: Optional[Decimal]
    commission_asset: Optional[str]
    executed_at: datetime
    realized_pnl_usd: Optional[Decimal]
    realized_pnl_percentage: Optional[Decimal]

class TradeHistoryResponse(BaseModel):
    trades: List[TradeResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int

@router.get("/trades", response_model=Dict[str, Any])
async def get_trade_history(
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    symbol: Optional[str] = Query(None, description="Filter by trading pair (e.g., BTCUSDT)"),
    side: Optional[str] = Query(None, description="Filter by side (BUY/SELL)"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    db = Depends(get_db)
):
    """
    Get paginated trade history with filtering options
    
    Query Parameters:
    - user_id: User ID (default: 1)
    - page: Page number (default: 1)
    - page_size: Items per page (default: 50, max: 1000)
    - symbol: Filter by trading pair (optional)
    - side: Filter by BUY/SELL (optional)
    - start_date: Start date filter (optional)
    - end_date: End date filter (optional)
    """
    try:
        # Build query with joins to get asset symbols
        query = (
            db.query(Trade, Asset.symbol.label('base_symbol'), Asset.symbol.label('quote_symbol'))
            .join(Asset, Trade.base_asset_id == Asset.id)
            .filter(Trade.user_id == current_user.id)
        )
        
        # Apply filters
        if symbol:
            query = query.filter(Trade.symbol == symbol.upper())
        
        if side:
            query = query.filter(Trade.side == side.upper())
        
        if start_date:
            query = query.filter(Trade.executed_at >= start_date)
        
        if end_date:
            # Add one day to include the entire end date
            end_datetime = datetime.combine(end_date, datetime.max.time())
            query = query.filter(Trade.executed_at <= end_datetime)
        
        # Order by most recent first
        query = query.order_by(Trade.executed_at.desc())
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination
        offset = (page - 1) * page_size
        trades_data = query.offset(offset).limit(page_size).all()
        
        # Format trades
        trades_list = []
        for trade, base_symbol, quote_symbol in trades_data:
            trades_list.append({
                "id": trade.id,
                "binance_order_id": trade.binance_order_id,
                "binance_trade_id": trade.binance_trade_id,
                "symbol": trade.symbol,
                "base_asset": base_symbol,
                "quote_asset": quote_symbol,
                "side": trade.side,
                "order_type": trade.order_type,
                "quantity": float(trade.quantity),
                "price": float(trade.price),
                "quote_quantity": float(trade.quote_quantity),
                "commission": float(trade.commission) if trade.commission else None,
                "commission_asset": trade.commission_asset,
                "executed_at": trade.executed_at.isoformat(),
                "realized_pnl_usd": float(trade.realized_pnl_usd) if trade.realized_pnl_usd else None,
                "realized_pnl_percentage": float(trade.realized_pnl_percentage) if trade.realized_pnl_percentage else None
            })
        
        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size
        
        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "trades": trades_list,
                "pagination": {
                    "total_count": total_count,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_previous": page > 1
                },
                "filters": {
                    "symbol": symbol,
                    "side": side,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None
                }
            }
        }
        
    except Exception as e:
        raise DatabaseError(f"Error fetching trades: {str(e)}")

@router.get("/trades/stats", response_model=Dict[str, Any])
async def get_trade_statistics(
    current_user: User = Depends(get_current_active_user),
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db = Depends(get_db)
):
    """
    Get trading statistics for the specified period
    
    Returns:
    - Total trades count
    - Buy vs Sell ratio
    - Most traded symbols
    - Trading volume
    - Average trade size
    """
    try:
        from datetime import datetime, timedelta
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get trades in the period
        trades = db.query(Trade).filter(
            Trade.user_id == current_user.id,
            Trade.executed_at >= start_date,
            Trade.executed_at <= end_date
        ).all()
        
        if not trades:
            return {
                "success": True,
                "user_id": current_user.id,
                "period_days": days,
                "stats": {
                    "total_trades": 0,
                    "buy_trades": 0,
                    "sell_trades": 0,
                    "total_volume_usd": 0,
                    "average_trade_size_usd": 0,
                    "most_traded_symbols": [],
                    "trading_days": 0
                }
            }
        
        # Calculate statistics
        total_trades = len(trades)
        buy_trades = len([t for t in trades if t.side == 'BUY'])
        sell_trades = len([t for t in trades if t.side == 'SELL'])
        
        total_volume = sum(t.quote_quantity for t in trades)
        average_trade_size = total_volume / total_trades if total_trades > 0 else Decimal('0')
        
        # Most traded symbols
        symbol_counts = {}
        for trade in trades:
            symbol_counts[trade.symbol] = symbol_counts.get(trade.symbol, 0) + 1
        
        most_traded = sorted(symbol_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        # Trading days (unique dates)
        trading_dates = set(trade.executed_at.date() for trade in trades)
        trading_days = len(trading_dates)
        
        return {
            "success": True,
            "user_id": current_user.id,
            "period_days": days,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "stats": {
                "total_trades": total_trades,
                "buy_trades": buy_trades,
                "sell_trades": sell_trades,
                "buy_sell_ratio": f"{buy_trades}:{sell_trades}",
                "total_volume_usd": float(total_volume),
                "average_trade_size_usd": float(average_trade_size),
                "most_traded_symbols": [{"symbol": symbol, "count": count} for symbol, count in most_traded],
                "trading_days": trading_days,
                "trades_per_day": round(total_trades / max(trading_days, 1), 2)
            }
        }
        
    except Exception as e:
        raise DatabaseError(f"Error calculating trade statistics: {str(e)}")

# NOTE: Route ordering matters. Static paths (/trades/history) and the typed
# integer id route (/trades/{trade_id:int}) must be declared BEFORE the greedy
# string route (/trades/{symbol}); otherwise the symbol route swallows them.
# The real trade-import endpoints live in trade_import.py; the previous fake
# "implementation pending" placeholders here have been removed because they
# shadowed those real routes and returned misleading success responses.

@router.get("/trades/history", response_model=Dict[str, Any])
async def get_trades_history(
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    db = Depends(get_db)
):
    """
    Get trade history (alias to main trades endpoint)
    """
    return await get_trade_history(current_user, page, page_size, None, None, None, None, db)

@router.get("/trades/{trade_id:int}", response_model=Dict[str, Any])
async def get_trade_by_id(
    trade_id: int,
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Get specific trade by ID
    """
    try:
        # Look for trade by ID for this user
        trade = db.query(Trade).filter(
            Trade.id == trade_id,
            Trade.user_id == current_user.id
        ).first()

        if not trade:
            raise NotFoundError(f"Trade with ID {trade_id} not found")

        return {
            "success": True,
            "trade": {
                "id": trade.id,
                "symbol": trade.symbol,
                "side": trade.side,
                "quantity": float(trade.quantity),
                "price": float(trade.price),
                "quote_quantity": float(trade.quote_quantity),
                "executed_at": trade.executed_at.isoformat(),
                "realized_pnl_usd": float(trade.realized_pnl_usd) if trade.realized_pnl_usd else None
            }
        }

    except Exception as e:
        if isinstance(e, NotFoundError):
            raise
        raise DatabaseError(f"Error fetching trade: {str(e)}")

@router.get("/trades/{symbol}", response_model=Dict[str, Any])
async def get_trades_by_symbol(
    symbol: str,
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of trades to return"),
    db = Depends(get_db)
):
    """
    Get trade history for a specific trading pair
    """
    try:
        # Basic symbol format validation. (Queries use the ORM with bound
        # parameters, so this is defense-in-depth, not the SQL-injection guard.)
        import re
        if not re.match(r'^[A-Za-z0-9/\-_]{1,20}$', symbol):
            raise HTTPException(status_code=400, detail="Invalid symbol format")

        trades = db.query(Trade).filter(
            Trade.user_id == current_user.id,
            Trade.symbol == symbol.upper()
        ).order_by(Trade.executed_at.desc()).limit(limit).all()

        trades_list = []
        for trade in trades:
            trades_list.append({
                "id": trade.id,
                "binance_order_id": trade.binance_order_id,
                "side": trade.side,
                "quantity": float(trade.quantity),
                "price": float(trade.price),
                "quote_quantity": float(trade.quote_quantity),
                "commission": float(trade.commission) if trade.commission else None,
                "executed_at": trade.executed_at.isoformat()
            })

        return {
            "success": True,
            "symbol": symbol.upper(),
            "user_id": current_user.id,
            "total_trades": len(trades_list),
            "trades": trades_list
        }

    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors) without converting them
        raise
    except Exception as e:
        raise DatabaseError(f"Error fetching trades for {symbol}: {str(e)}")