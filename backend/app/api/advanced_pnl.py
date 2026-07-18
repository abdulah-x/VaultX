"""
Advanced P&L Calculation Service
Real-time profit/loss calculation with detailed analytics
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
import logging
from collections import defaultdict

from core.dependencies import get_db, get_current_active_user
from database.models import User, Holding, Trade, Asset
from services.binance.client import BinanceClientManager, run_sync

router = APIRouter()
logger = logging.getLogger(__name__)

class AdvancedPnLCalculator:
    """Advanced P&L calculation with real-time data"""
    
    def __init__(self):
        self.client_manager = BinanceClientManager()
    
    async def calculate_comprehensive_pnl(
        self,
        user_id: int,
        db: Session,
        symbol: Optional[str] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive P&L with multiple methodologies
        """
        try:
            logger.info(f"📊 Calculating P&L for user {user_id}")
            
            # Get user's portfolio and trades
            portfolio_query = db.query(Holding).filter(Holding.user_id == user_id)
            trades_query = db.query(Trade).filter(Trade.user_id == user_id)

            if symbol:
                # Holdings reference assets by FK; resolve the symbol to an asset id.
                filter_asset = db.query(Asset).filter(Asset.symbol == symbol.upper()).first()
                if filter_asset:
                    portfolio_query = portfolio_query.filter(Holding.asset_id == filter_asset.id)
                else:
                    portfolio_query = portfolio_query.filter(Holding.asset_id == -1)  # no match
                trades_query = trades_query.filter(Trade.symbol == symbol.upper())

            # Date filter for trades
            if days < 365:  # Only apply date filter if not requesting full history
                start_date = datetime.utcnow() - timedelta(days=days)
                trades_query = trades_query.filter(Trade.executed_at >= start_date)

            portfolios = portfolio_query.all()
            trades = trades_query.all()

            # Resolve each holding's ticker symbol once and attach it, so the
            # downstream calculators can reference `holding.symbol` (the Holding
            # model itself only stores an asset_id foreign key).
            asset_ids = [p.asset_id for p in portfolios]
            symbol_map = dict(
                db.query(Asset.id, Asset.symbol).filter(Asset.id.in_(asset_ids)).all()
            ) if asset_ids else {}
            for p in portfolios:
                p.symbol = symbol_map.get(p.asset_id, "")
            
            if not portfolios and not trades:
                return {
                    "success": True,
                    "message": "No portfolio or trade data found",
                    "pnl_summary": {},
                    "detailed_pnl": []
                }
            
            # Get current prices
            current_prices = await self._get_current_prices(portfolios)
            
            # Calculate P&L using different methods
            pnl_results = {
                "portfolio_based": await self._calculate_portfolio_pnl(portfolios, current_prices),
                "trade_based": await self._calculate_trade_based_pnl(trades, current_prices, db),
                "realized_vs_unrealized": await self._calculate_realized_unrealized_pnl(portfolios, trades, current_prices),
                "time_series": await self._calculate_time_series_pnl(trades, current_prices, days),
                "performance_metrics": await self._calculate_performance_metrics(portfolios, trades, current_prices)
            }
            
            # Create comprehensive summary
            summary = self._create_pnl_summary(pnl_results)
            
            logger.info(f"✅ P&L calculation completed for user {user_id}")
            
            return {
                "success": True,
                "pnl_summary": summary,
                "detailed_pnl": pnl_results,
                "calculation_time": datetime.utcnow().isoformat(),
                "period_days": days,
                "symbol_filter": symbol
            }
            
        except Exception as e:
            logger.error(f"❌ P&L calculation failed for user {user_id}: {e}")
            return {
                "success": False,
                "message": f"P&L calculation failed: {str(e)}",
                "error": "calculation_failed"
            }
    
    async def _get_current_prices(self, portfolios: List[Holding]) -> Dict[str, float]:
        """Get current prices for all portfolio assets"""
        prices = {}
        client = await run_sync(self.client_manager.get_client)

        if not client:
            logger.warning("⚠️ Binance client not available for price fetching")
            return prices

        try:
            # Get all tickers at once (blocking call offloaded to a thread)
            all_tickers = await run_sync(client.get_all_tickers)
            ticker_dict = {ticker['symbol']: float(ticker['price']) for ticker in all_tickers}
            
            for portfolio in portfolios:
                asset = portfolio.symbol
                
                # Try different trading pairs
                potential_symbols = [f"{asset}USDT", f"{asset}BUSD", f"{asset}BTC", f"{asset}ETH"]
                
                for symbol in potential_symbols:
                    if symbol in ticker_dict:
                        prices[asset] = ticker_dict[symbol]
                        break
                
                # For stablecoins
                if asset in ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP']:
                    prices[asset] = 1.0
                    
        except Exception as e:
            logger.warning(f"⚠️ Failed to get current prices: {e}")
        
        return prices
    
    async def _calculate_portfolio_pnl(self, portfolios: List[Holding], current_prices: Dict[str, float]) -> Dict[str, Any]:
        """Calculate P&L based on current portfolio holdings"""
        portfolio_pnl = {
            "total_current_value": 0,
            "total_invested": 0,
            "total_pnl": 0,
            "total_pnl_percentage": 0,
            "assets": []
        }
        
        for portfolio in portfolios:
            asset = portfolio.symbol
            quantity = float(portfolio.total_quantity)
            avg_price = float(portfolio.average_cost_usd or 0)
            current_price = current_prices.get(asset, 0)
            
            invested_value = quantity * avg_price
            current_value = quantity * current_price
            pnl = current_value - invested_value
            pnl_percentage = (pnl / invested_value * 100) if invested_value > 0 else 0
            
            asset_data = {
                "asset": asset,
                "quantity": quantity,
                "average_price": avg_price,
                "current_price": current_price,
                "invested_value": invested_value,
                "current_value": current_value,
                "pnl": pnl,
                "pnl_percentage": pnl_percentage
            }
            
            portfolio_pnl["assets"].append(asset_data)
            portfolio_pnl["total_current_value"] += current_value
            portfolio_pnl["total_invested"] += invested_value
        
        portfolio_pnl["total_pnl"] = portfolio_pnl["total_current_value"] - portfolio_pnl["total_invested"]
        if portfolio_pnl["total_invested"] > 0:
            portfolio_pnl["total_pnl_percentage"] = portfolio_pnl["total_pnl"] / portfolio_pnl["total_invested"] * 100
        
        return portfolio_pnl
    
    async def _calculate_trade_based_pnl(self, trades: List[Trade], current_prices: Dict[str, float], db: Session) -> Dict[str, Any]:
        """Calculate P&L based on actual trades (FIFO method)"""
        if not trades:
            return {"message": "No trades available for calculation"}
        
        # Group trades by symbol
        trades_by_symbol = defaultdict(list)
        for trade in trades:
            trades_by_symbol[trade.symbol].append(trade)
        
        trade_pnl = {
            "realized_pnl": 0,
            "unrealized_pnl": 0,
            "total_pnl": 0,
            "assets": []
        }
        
        for symbol, symbol_trades in trades_by_symbol.items():
            # Sort trades by execution time
            symbol_trades.sort(key=lambda x: x.executed_at)
            
            # Calculate using FIFO method
            position = 0  # Current position
            avg_cost = 0   # Average cost basis
            realized_pnl = 0
            total_bought = 0
            total_sold = 0
            
            for trade in symbol_trades:
                quantity = float(trade.quantity)
                price = float(trade.price)
                
                if trade.side == "BUY":
                    # Update average cost basis
                    if position >= 0:
                        avg_cost = ((position * avg_cost) + (quantity * price)) / (position + quantity)
                    else:
                        avg_cost = price  # Starting fresh after being short
                    position += quantity
                    total_bought += quantity * price
                    
                else:  # SELL
                    if position > 0:
                        # Realize profit/loss
                        sell_quantity = min(quantity, position)
                        realized_pnl += sell_quantity * (price - avg_cost)
                        position -= sell_quantity
                        # Value the sale by the quantity actually matched against
                        # the position (sell_quantity), not the raw order quantity.
                        # Using `quantity` overcounts total_sold whenever an order
                        # sells more than the held position, so it no longer ties
                        # out with realized_pnl (which only counts sell_quantity).
                        total_sold += sell_quantity * price
            
            # Calculate unrealized P&L for remaining position
            current_price = current_prices.get(symbol.replace('USDT', '').replace('BUSD', ''), 0)
            unrealized_pnl = position * (current_price - avg_cost) if position > 0 and current_price > 0 else 0
            
            asset_pnl = {
                "symbol": symbol,
                "current_position": position,
                "average_cost": avg_cost,
                "current_price": current_price,
                "realized_pnl": realized_pnl,
                "unrealized_pnl": unrealized_pnl,
                "total_pnl": realized_pnl + unrealized_pnl,
                "total_bought": total_bought,
                "total_sold": total_sold,
                "trade_count": len(symbol_trades)
            }
            
            trade_pnl["assets"].append(asset_pnl)
            trade_pnl["realized_pnl"] += realized_pnl
            trade_pnl["unrealized_pnl"] += unrealized_pnl
        
        trade_pnl["total_pnl"] = trade_pnl["realized_pnl"] + trade_pnl["unrealized_pnl"]
        
        return trade_pnl
    
    async def _calculate_realized_unrealized_pnl(self, portfolios: List[Holding], trades: List[Trade], current_prices: Dict[str, float]) -> Dict[str, Any]:
        """Separate realized vs unrealized P&L"""
        realized_pnl = 0
        unrealized_pnl = 0
        
        # Calculate realized P&L from completed trades
        trades_by_symbol = defaultdict(list)
        for trade in trades:
            trades_by_symbol[trade.symbol].append(trade)
        
        for symbol, symbol_trades in trades_by_symbol.items():
            symbol_trades.sort(key=lambda x: x.executed_at)
            
            # Simple realized P&L calculation
            total_buy_value = sum(float(t.quantity) * float(t.price) for t in symbol_trades if t.side == "BUY")
            total_sell_value = sum(float(t.quantity) * float(t.price) for t in symbol_trades if t.side == "SELL")
            
            # This is a simplified calculation - would need more sophisticated matching in production
            if total_sell_value > 0:
                realized_pnl += total_sell_value - total_buy_value
        
        # Calculate unrealized P&L from current holdings
        for portfolio in portfolios:
            if portfolio.current_value_usd and portfolio.average_cost_usd:
                quantity = float(portfolio.total_quantity)
                avg_price = float(portfolio.average_cost_usd)
                current_price = current_prices.get(portfolio.symbol, avg_price)

                unrealized_pnl += quantity * (current_price - avg_price)
        
        return {
            "realized_pnl": realized_pnl,
            "unrealized_pnl": unrealized_pnl,
            "total_pnl": realized_pnl + unrealized_pnl,
            "realized_percentage": (realized_pnl / (realized_pnl + unrealized_pnl) * 100) if (realized_pnl + unrealized_pnl) != 0 else 0
        }
    
    async def _calculate_time_series_pnl(self, trades: List[Trade], current_prices: Dict[str, float], days: int) -> Dict[str, Any]:
        """Calculate realized P&L over time for visualization, from actual trade.realized_pnl_usd"""
        if not trades:
            return {"daily_pnl": {}, "cumulative_pnl": {}}

        # Group trades by date
        daily_trades = defaultdict(list)
        for trade in trades:
            if trade.realized_pnl_usd is None:
                continue
            date_key = trade.executed_at.strftime('%Y-%m-%d')
            daily_trades[date_key].append(trade)

        daily_pnl = {}
        cumulative_pnl = 0

        # Calculate daily realized P&L from actual recorded values, not an assumption
        for date, date_trades in sorted(daily_trades.items()):
            daily_realized = sum(float(trade.realized_pnl_usd) for trade in date_trades)
            daily_pnl[date] = daily_realized
            cumulative_pnl += daily_realized

        return {
            "daily_pnl": daily_pnl,
            "cumulative_pnl": cumulative_pnl,
            "trading_days": len(daily_pnl)
        }
    
    async def _calculate_performance_metrics(self, portfolios: List[Holding], trades: List[Trade], current_prices: Dict[str, float]) -> Dict[str, Any]:
        """Calculate advanced performance metrics"""
        if not trades:
            return {"message": "No trades available for performance metrics"}
        
        # Calculate basic metrics
        total_trades = len(trades)
        buy_trades = len([t for t in trades if t.side == "BUY"])
        sell_trades = len([t for t in trades if t.side == "SELL"])
        
        total_volume = sum(float(t.quote_quantity or 0) for t in trades)
        total_fees = sum(float(t.commission or 0) for t in trades)
        
        # Trading frequency
        if trades:
            first_trade = min(trades, key=lambda x: x.executed_at).executed_at
            last_trade = max(trades, key=lambda x: x.executed_at).executed_at
            trading_period = (last_trade - first_trade).days + 1
            avg_trades_per_day = total_trades / trading_period if trading_period > 0 else 0
        else:
            trading_period = 0
            avg_trades_per_day = 0
        
        # Portfolio value
        total_portfolio_value = sum(
            float(p.current_value_usd or 0) for p in portfolios
        )
        
        return {
            "total_trades": total_trades,
            "buy_trades": buy_trades,
            "sell_trades": sell_trades,
            "total_volume": total_volume,
            "total_fees": total_fees,
            "trading_period_days": trading_period,
            "avg_trades_per_day": round(avg_trades_per_day, 2),
            "current_portfolio_value": total_portfolio_value,
            "fee_percentage": (total_fees / total_volume * 100) if total_volume > 0 else 0
        }
    
    def _create_pnl_summary(self, pnl_results: Dict[str, Any]) -> Dict[str, Any]:
        """Create a comprehensive P&L summary"""
        portfolio_pnl = pnl_results.get("portfolio_based", {})
        trade_pnl = pnl_results.get("trade_based", {})
        realized_unrealized = pnl_results.get("realized_vs_unrealized", {})
        performance = pnl_results.get("performance_metrics", {})
        
        return {
            "total_portfolio_value": portfolio_pnl.get("total_current_value", 0),
            "total_invested": portfolio_pnl.get("total_invested", 0),
            "total_pnl": portfolio_pnl.get("total_pnl", 0),
            "total_pnl_percentage": portfolio_pnl.get("total_pnl_percentage", 0),
            "realized_pnl": realized_unrealized.get("realized_pnl", 0),
            "unrealized_pnl": realized_unrealized.get("unrealized_pnl", 0),
            "total_trades": performance.get("total_trades", 0),
            "total_volume": performance.get("total_volume", 0),
            "total_fees": performance.get("total_fees", 0),
            "performance_rating": self._get_performance_rating(portfolio_pnl.get("total_pnl_percentage", 0))
        }
    
    def _get_performance_rating(self, pnl_percentage: float) -> str:
        """Get performance rating based on P&L percentage"""
        if pnl_percentage >= 50:
            return "🚀 Excellent"
        elif pnl_percentage >= 20:
            return "📈 Very Good"
        elif pnl_percentage >= 10:
            return "✅ Good"
        elif pnl_percentage >= 0:
            return "🔄 Break Even"
        elif pnl_percentage >= -10:
            return "⚠️ Minor Loss"
        elif pnl_percentage >= -25:
            return "📉 Moderate Loss"
        else:
            return "🔴 Significant Loss"

# Global P&L calculator instance
pnl_calculator = AdvancedPnLCalculator()

@router.get("/pnl/comprehensive", response_model=Dict[str, Any])
async def get_comprehensive_pnl(
    symbol: Optional[str] = Query(None, description="Filter by specific symbol"),
    days: int = Query(30, ge=1, le=365, description="Analysis period in days"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive P&L analysis with multiple calculation methods
    """
    try:
        result = await pnl_calculator.calculate_comprehensive_pnl(
            current_user.id, db, symbol, days
        )
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"P&L calculation failed: {str(e)}")

@router.get("/pnl/advanced-summary", response_model=Dict[str, Any])
async def get_advanced_pnl_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get quick advanced P&L summary for dashboard
    """
    try:
        result = await pnl_calculator.calculate_comprehensive_pnl(current_user.id, db, days=30)
        
        return {
            "success": result["success"],
            "summary": result.get("pnl_summary", {}),
            "last_updated": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"P&L summary failed: {str(e)}")

@router.get("/pnl/performance", response_model=Dict[str, Any])
async def get_performance_analytics(
    days: int = Query(30, ge=1, le=365, description="Analysis period in days"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed performance analytics and metrics
    """
    try:
        result = await pnl_calculator.calculate_comprehensive_pnl(current_user.id, db, days=days)
        
        if not result["success"]:
            return result
            
        performance_data = result["detailed_pnl"].get("performance_metrics", {})
        time_series = result["detailed_pnl"].get("time_series", {})
        
        return {
            "success": True,
            "performance_metrics": performance_data,
            "time_series": time_series,
            "period_days": days
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Performance analytics failed: {str(e)}")