"""
Trade History Import Service
Import and process trade history from Binance
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from decimal import Decimal
from datetime import datetime, timedelta
import logging

from core.dependencies import get_db, get_current_active_user
from core.errors import DatabaseError, ValidationError
from database.models import User, Trade
from services.binance.client import BinanceClientManager, run_sync
from api.portfolio_sync import get_or_create_asset

router = APIRouter()
logger = logging.getLogger(__name__)

# Known quote assets, longest first so e.g. "USDT" matches before "USD".
QUOTE_ASSETS = ['USDT', 'FDUSD', 'BUSD', 'USDC', 'TUSD', 'USDP', 'DAI', 'BTC', 'ETH', 'BNB']


def split_symbol(symbol: str):
    """Split a trading pair like 'BTCUSDT' into ('BTC', 'USDT').

    Falls back to (symbol, 'USDT') if no known quote suffix matches.
    """
    symbol = symbol.upper()
    for quote in QUOTE_ASSETS:
        if symbol.endswith(quote) and len(symbol) > len(quote):
            return symbol[: -len(quote)], quote
    return symbol, 'USDT'

class TradeHistoryImporter:
    """Advanced trade history import from Binance"""
    
    def __init__(self):
        self.client_manager = BinanceClientManager()
    
    async def import_trade_history(
        self, 
        user_id: int, 
        db: Session,
        symbol: Optional[str] = None,
        limit: int = 500,
        days_back: int = 30
    ) -> Dict[str, Any]:
        """
        Import trade history from Binance with advanced processing
        """
        try:
            client = await run_sync(self.client_manager.get_client)
            if not client:
                return {
                    "success": False,
                    "message": "Binance client not available",
                    "error": "client_unavailable"
                }
            
            logger.info(f"🔄 Starting trade import for user {user_id}")
            
            # Calculate time range
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=days_back)
            
            # Get all symbols if none specified
            symbols_to_process = []
            if symbol:
                symbols_to_process = [symbol.upper()]
            else:
                # Get account info to find symbols with trades
                account_info = await run_sync(client.get_account)
                balances = account_info.get('balances', [])
                
                # Get symbols that have been traded (have balances or recent activity)
                for balance in balances:
                    asset = balance['asset']
                    if float(balance['free']) > 0 or float(balance['locked']) > 0:
                        # Try common trading pairs
                        potential_symbols = [
                            f"{asset}USDT",
                            f"{asset}BUSD", 
                            f"{asset}BTC",
                            f"{asset}ETH"
                        ]
                        symbols_to_process.extend(potential_symbols)
            
            # Remove duplicates and limit
            symbols_to_process = list(set(symbols_to_process))[:50]  # Limit to prevent rate limiting
            
            all_trades = []
            processed_symbols = []
            failed_symbols = []
            
            for trading_symbol in symbols_to_process:
                try:
                    # Get trades for this symbol (blocking call offloaded to a thread)
                    trades = await run_sync(
                        client.get_my_trades,
                        symbol=trading_symbol,
                        limit=limit,
                        startTime=int(start_time.timestamp() * 1000),
                        endTime=int(end_time.timestamp() * 1000)
                    )
                    
                    if trades:
                        processed_trades = self._process_trades(trades, trading_symbol, user_id)
                        all_trades.extend(processed_trades)
                        processed_symbols.append(trading_symbol)
                        logger.info(f"✅ Imported {len(trades)} trades for {trading_symbol}")
                    
                except Exception as e:
                    failed_symbols.append({"symbol": trading_symbol, "error": str(e)})
                    logger.warning(f"⚠️ Failed to get trades for {trading_symbol}: {e}")
                    continue
            
            # Import trades to database
            import_results = await self._import_trades_to_db(all_trades, db)
            
            logger.info(f"✅ Trade import completed for user {user_id}")
            
            return {
                "success": True,
                "message": "Trade history import completed",
                "import_results": import_results,
                "processed_symbols": processed_symbols,
                "failed_symbols": failed_symbols,
                "total_trades_found": len(all_trades),
                "time_range": {
                    "start": start_time.isoformat(),
                    "end": end_time.isoformat(),
                    "days": days_back
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Trade import failed for user {user_id}: {e}")
            return {
                "success": False,
                "message": f"Trade import failed: {str(e)}",
                "error": "import_failed"
            }
    
    def _process_trades(self, trades: List[Dict], symbol: str, user_id: int) -> List[Dict]:
        """Process raw Binance trades into standardized format"""
        processed = []
        
        for trade in trades:
            try:
                base_symbol, quote_symbol = split_symbol(symbol)
                processed_trade = {
                    "user_id": user_id,
                    "binance_order_id": str(trade.get('orderId', '')),
                    "binance_trade_id": str(trade.get('id', '')),
                    "symbol": symbol,
                    "base_symbol": base_symbol,
                    "quote_symbol": quote_symbol,
                    "side": "BUY" if trade.get('isBuyer', False) else "SELL",
                    "order_type": trade.get('orderType', 'MARKET'),
                    "quantity": Decimal(str(trade.get('qty', '0'))),
                    "price": Decimal(str(trade.get('price', '0'))),
                    "quote_quantity": Decimal(str(trade.get('quoteQty', '0'))),
                    "commission": Decimal(str(trade.get('commission', '0'))),
                    "commission_asset": trade.get('commissionAsset', ''),
                    "executed_at": datetime.fromtimestamp(trade.get('time', 0) / 1000),
                }
                processed.append(processed_trade)
                
            except Exception as e:
                logger.warning(f"⚠️ Failed to process trade {trade}: {e}")
                continue
        
        return processed
    
    async def _import_trades_to_db(self, trades: List[Dict], db: Session) -> Dict[str, Any]:
        """Import processed trades to database"""
        try:
            imported_count = 0
            updated_count = 0
            skipped_count = 0
            
            for trade_data in trades:
                # Check if trade already exists
                existing = db.query(Trade).filter(
                    Trade.user_id == trade_data['user_id'],
                    Trade.binance_trade_id == trade_data['binance_trade_id']
                ).first()
                
                if existing:
                    # Update existing trade if data is different
                    if (existing.quantity != trade_data['quantity'] or
                        existing.price != trade_data['price']):

                        existing.quantity = trade_data['quantity']
                        existing.price = trade_data['price']
                        existing.quote_quantity = trade_data['quote_quantity']
                        existing.commission = trade_data['commission']
                        existing.commission_asset = trade_data['commission_asset']
                        updated_count += 1
                    else:
                        skipped_count += 1
                else:
                    # Resolve the base/quote assets (required FKs on Trade).
                    base_asset = get_or_create_asset(db, trade_data['base_symbol'])
                    quote_asset = get_or_create_asset(db, trade_data['quote_symbol'])

                    # Create new trade
                    new_trade = Trade(
                        user_id=trade_data['user_id'],
                        binance_order_id=trade_data['binance_order_id'],
                        binance_trade_id=trade_data['binance_trade_id'],
                        symbol=trade_data['symbol'],
                        base_asset_id=base_asset.id,
                        quote_asset_id=quote_asset.id,
                        side=trade_data['side'],
                        order_type=trade_data['order_type'],
                        quantity=trade_data['quantity'],
                        price=trade_data['price'],
                        quote_quantity=trade_data['quote_quantity'],
                        commission=trade_data['commission'],
                        commission_asset=trade_data['commission_asset'],
                        executed_at=trade_data['executed_at'],
                    )
                    db.add(new_trade)
                    imported_count += 1
            
            db.commit()
            
            return {
                "imported_new": imported_count,
                "updated_existing": updated_count,
                "skipped_duplicates": skipped_count,
                "total_processed": len(trades)
            }
            
        except Exception as e:
            db.rollback()
            raise e

# Global trade importer instance
trade_importer = TradeHistoryImporter()

@router.post("/trades/import", response_model=Dict[str, Any])
async def import_trade_history(
    symbol: Optional[str] = Query(None, description="Specific symbol to import (e.g., BTCUSDT)"),
    limit: int = Query(500, ge=1, le=1000, description="Maximum trades per symbol"),
    days_back: int = Query(30, ge=1, le=365, description="Days of history to import"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Import trade history from Binance
    """
    try:
        result = await trade_importer.import_trade_history(
            current_user.id, db, symbol, limit, days_back
        )
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@router.get("/trades/analysis", response_model=Dict[str, Any])
async def get_trade_analysis(
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    days: int = Query(30, ge=1, le=365, description="Analysis period in days"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive trade analysis and statistics
    """
    try:
        # Build query
        query = db.query(Trade).filter(Trade.user_id == current_user.id)
        
        # Date filter
        start_date = datetime.utcnow() - timedelta(days=days)
        query = query.filter(Trade.executed_at >= start_date)
        
        # Symbol filter
        if symbol:
            query = query.filter(Trade.symbol == symbol.upper())
        
        trades = query.all()
        
        if not trades:
            return {
                "success": True,
                "message": "No trades found for analysis",
                "analysis": {},
                "trades_count": 0
            }
        
        # Perform analysis
        analysis = {
            "total_trades": len(trades),
            "total_volume": float(sum(trade.quote_quantity for trade in trades if trade.quote_quantity)),
            "total_commission": float(sum(trade.commission for trade in trades if trade.commission)),
            "buy_trades": len([t for t in trades if t.side == "BUY"]),
            "sell_trades": len([t for t in trades if t.side == "SELL"]),
            "symbols_traded": len(set(trade.symbol for trade in trades)),
            "average_trade_size": 0,
            "largest_trade": 0,
            "smallest_trade": float('inf'),
            "trading_frequency": {},
            "symbol_breakdown": {},
            "daily_volume": {}
        }
        
        # Calculate averages and extremes
        if trades:
            volumes = [float(trade.quote_quantity) for trade in trades if trade.quote_quantity]
            if volumes:
                analysis["average_trade_size"] = sum(volumes) / len(volumes)
                analysis["largest_trade"] = max(volumes)
                analysis["smallest_trade"] = min(volumes)
        
        # Symbol breakdown
        symbol_stats = {}
        for trade in trades:
            symbol = trade.symbol
            if symbol not in symbol_stats:
                symbol_stats[symbol] = {
                    "trades": 0,
                    "volume": 0,
                    "buy_trades": 0,
                    "sell_trades": 0
                }
            
            symbol_stats[symbol]["trades"] += 1
            symbol_stats[symbol]["volume"] += float(trade.quote_quantity or 0)
            if trade.side == "BUY":
                symbol_stats[symbol]["buy_trades"] += 1
            else:
                symbol_stats[symbol]["sell_trades"] += 1
        
        analysis["symbol_breakdown"] = symbol_stats
        
        # Daily volume
        daily_volumes = {}
        for trade in trades:
            date_key = trade.executed_at.strftime('%Y-%m-%d')
            if date_key not in daily_volumes:
                daily_volumes[date_key] = 0
            daily_volumes[date_key] += float(trade.quote_quantity or 0)
        
        analysis["daily_volume"] = daily_volumes
        
        return {
            "success": True,
            "analysis": analysis,
            "period": {
                "days": days,
                "start_date": start_date.isoformat(),
                "end_date": datetime.utcnow().isoformat()
            },
            "symbol_filter": symbol
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.get("/trades/import/status", response_model=Dict[str, Any])
async def get_import_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get trade import status and statistics
    """
    try:
        # Get trade counts
        total_trades = db.query(Trade).filter(Trade.user_id == current_user.id).count()
        
        # Get recent imports
        recent_trades = db.query(Trade).filter(
            Trade.user_id == current_user.id,
            Trade.created_at >= datetime.utcnow() - timedelta(days=7)
        ).count()
        
        # Get symbols with trades
        symbols_with_trades = db.query(Trade.symbol).filter(
            Trade.user_id == current_user.id
        ).distinct().all()
        
        return {
            "success": True,
            "status": {
                "total_trades": total_trades,
                "recent_imports": recent_trades,
                "symbols_with_trades": len(symbols_with_trades),
                "symbols": [s[0] for s in symbols_with_trades],
                "last_import": None  # Would need additional tracking
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")