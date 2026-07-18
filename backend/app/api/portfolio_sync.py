"""
Advanced Portfolio Sync Service
Automatically sync Binance portfolio data with local database
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from decimal import Decimal
from datetime import datetime, timedelta
import asyncio
import logging

from core.dependencies import get_db, get_current_active_user
from core.errors import DatabaseError, ValidationError
from core.audit import log_audit_event
from core.decimal_utils import stringify_decimals
from database.models import User, Holding, Asset
from services.binance.client import BinanceClientManager, run_sync
from services.binance.account import BinanceAccountService

router = APIRouter()
logger = logging.getLogger(__name__)

MAJOR_COINS = {'BTC', 'ETH', 'BNB', 'ADA', 'DOT', 'SOL', 'MATIC', 'AVAX', 'LINK'}
STABLECOINS = {'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD'}


def categorize_asset(symbol: str, total_amount: float = 0.0) -> str:
    """Bucket an asset symbol into major / stable / altcoin / other."""
    if symbol in MAJOR_COINS:
        return "major"
    if symbol in STABLECOINS:
        return "stable"
    if total_amount > 0:
        return "altcoin"
    return "other"


def get_or_create_asset(db: Session, symbol: str) -> Asset:
    """Fetch the Asset row for a ticker symbol, creating a minimal one if absent.

    Holdings reference assets by FK, so a balance sync must ensure the asset
    exists before it can upsert the holding.
    """
    asset = db.query(Asset).filter(Asset.symbol == symbol).first()
    if asset is None:
        asset = Asset(
            symbol=symbol,
            name=symbol,
            asset_type='cryptocurrency',
            is_base_currency=symbol in STABLECOINS,
        )
        db.add(asset)
        db.flush()  # assign asset.id without ending the transaction
    return asset

class AdvancedPortfolioSync:
    """Advanced portfolio synchronization with Binance"""
    
    def __init__(self):
        self.binance_service = BinanceAccountService()
        self.sync_in_progress = {}
        
    async def sync_user_portfolio(self, user_id: int, db: Session) -> Dict[str, Any]:
        """
        Comprehensive portfolio sync with enhanced features
        """
        try:
            if user_id in self.sync_in_progress:
                return {
                    "success": False,
                    "message": "Sync already in progress for this user",
                    "status": "in_progress"
                }
            
            self.sync_in_progress[user_id] = True
            sync_start_time = datetime.utcnow()
            
            logger.info(f"🔄 Starting portfolio sync for user {user_id}")
            
            # Get Binance balances (blocking call offloaded to a thread)
            binance_balances = await run_sync(self.binance_service.get_balances)
            if not binance_balances:
                return {
                    "success": False,
                    "message": "Failed to retrieve Binance balances",
                    "error": "binance_connection_failed"
                }
            
            # Get current prices for all assets
            prices = await self._get_asset_prices(binance_balances)
            
            # Process and categorize assets
            processed_assets = self._process_assets(binance_balances, prices)
            
            # Update database
            sync_results = await self._update_portfolio_database(
                user_id, processed_assets, db
            )
            
            sync_end_time = datetime.utcnow()
            sync_duration = (sync_end_time - sync_start_time).total_seconds()
            
            # Update user's last sync information
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.last_sync_at = sync_end_time
                user.last_sync_status = "success"
                db.commit()
            
            logger.info(f"✅ Portfolio sync completed for user {user_id} in {sync_duration:.2f}s")
            
            return {
                "success": True,
                "message": "Portfolio sync completed successfully",
                "sync_results": sync_results,
                "duration_seconds": sync_duration,
                "synced_at": sync_end_time.isoformat(),
                "total_assets": len(processed_assets),
                "categories": {
                    "major_coins": len([a for a in processed_assets if a["category"] == "major"]),
                    "stablecoins": len([a for a in processed_assets if a["category"] == "stable"]),
                    "altcoins": len([a for a in processed_assets if a["category"] == "altcoin"]),
                    "others": len([a for a in processed_assets if a["category"] == "other"])
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Portfolio sync failed for user {user_id}: {e}")
            
            # Update sync status as failed
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.last_sync_status = "failed"
                user.sync_error_message = str(e)[:500]
                db.commit()
            
            return {
                "success": False,
                "message": f"Portfolio sync failed: {str(e)}",
                "error": "sync_failed"
            }
        finally:
            # Remove from in-progress tracking
            self.sync_in_progress.pop(user_id, None)
    
    async def _get_asset_prices(self, balances: List[Dict]) -> Dict[str, float]:
        """Get current prices for all assets"""
        prices = {}
        client_manager = BinanceClientManager()
        client = await run_sync(client_manager.get_client)

        if not client:
            logger.warning("⚠️ Binance client not available for price fetching")
            return prices

        # Get all tickers at once (blocking call offloaded to a thread)
        try:
            all_tickers = await run_sync(client.get_all_tickers)
            # Keep Decimal from the Binance string straight through - going via
            # float() here and Decimal(str(float)) later double-rounds the value
            # before it's ever stored.
            ticker_dict = {ticker['symbol']: Decimal(str(ticker['price'])) for ticker in all_tickers}

            for balance in balances:
                asset = balance['asset']

                # Try different symbol combinations
                potential_symbols = [
                    f"{asset}USDT",
                    f"{asset}BUSD",
                    f"{asset}BTC",
                    f"{asset}ETH"
                ]

                for symbol in potential_symbols:
                    if symbol in ticker_dict:
                        prices[asset] = ticker_dict[symbol]
                        break

                # For stablecoins, assume $1
                if asset in ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP']:
                    prices[asset] = Decimal('1')

        except Exception as e:
            logger.warning(f"⚠️ Failed to get prices: {e}")

        return prices

    def _process_assets(self, balances: List[Dict], prices: Dict[str, Decimal]) -> List[Dict]:
        """Process and categorize assets with enhanced metadata"""
        processed = []

        # Asset categories
        major_coins = ['BTC', 'ETH', 'BNB', 'ADA', 'DOT', 'SOL', 'MATIC', 'AVAX', 'LINK']
        stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD']

        for balance in balances:
            asset = balance['asset']
            total_amount = Decimal(str(balance['total']))
            free_amount = Decimal(str(balance['free']))
            locked_amount = Decimal(str(balance['locked']))

            # Determine category
            if asset in major_coins:
                category = "major"
            elif asset in stablecoins:
                category = "stable"
            elif total_amount > 0:
                category = "altcoin" if asset not in ['BTC', 'ETH'] else "major"
            else:
                category = "other"

            # Calculate USD value
            price = prices.get(asset, Decimal('0'))
            usd_value = total_amount * price

            processed.append({
                "asset": asset,
                "total_amount": total_amount,
                "free_amount": free_amount,
                "locked_amount": locked_amount,
                "category": category,
                "price_usd": price,
                "value_usd": usd_value,
                "percentage_locked": (locked_amount / total_amount * 100) if total_amount > 0 else Decimal('0'),
                "last_updated": datetime.utcnow().isoformat()
            })

        # Sort by USD value (descending)
        processed.sort(key=lambda x: x['value_usd'], reverse=True)

        return processed
    
    async def _update_portfolio_database(self, user_id: int, assets: List[Dict], db: Session) -> Dict[str, Any]:
        """Update portfolio in database with sync results"""
        try:
            updated_count = 0
            created_count = 0

            # Batch-resolve assets: one query for all known symbols, instead of
            # one query per asset in the loop below.
            symbols = [asset_data['asset'] for asset_data in assets]
            existing_assets = db.query(Asset).filter(Asset.symbol.in_(symbols)).all()
            asset_by_symbol = {a.symbol: a for a in existing_assets}
            for symbol in symbols:
                if symbol not in asset_by_symbol:
                    # Rare path: first time this symbol is seen, still needs its
                    # own insert to get an id.
                    asset_by_symbol[symbol] = get_or_create_asset(db, symbol)

            # Batch-resolve existing holdings for this user across all synced
            # assets in one query, instead of one query per asset in the loop.
            asset_ids = [a.id for a in asset_by_symbol.values()]
            existing_holdings = db.query(Holding).filter(
                Holding.user_id == user_id,
                Holding.asset_id.in_(asset_ids)
            ).all()
            holding_by_asset_id = {h.asset_id: h for h in existing_holdings}

            for asset_data in assets:
                asset = asset_by_symbol[asset_data['asset']]

                total_qty = asset_data['total_amount']
                free_qty = asset_data['free_amount']
                locked_qty = asset_data['locked_amount']
                price = asset_data['price_usd'] if asset_data['price_usd'] > 0 else None
                value = asset_data['value_usd'] if asset_data['value_usd'] > 0 else None

                existing = holding_by_asset_id.get(asset.id)

                if existing:
                    # Update market-facing fields; preserve cost basis, which a
                    # balance sync cannot recompute (that comes from trade history).
                    existing.total_quantity = total_qty
                    existing.available_quantity = free_qty
                    existing.locked_quantity = locked_qty
                    existing.current_price_usd = price
                    existing.current_value_usd = value
                    if price is not None and existing.total_cost_usd is not None:
                        existing.unrealized_pnl_usd = (value or Decimal('0')) - existing.total_cost_usd
                    updated_count += 1
                else:
                    # New holding: seed cost basis from current value so initial
                    # unrealized P&L is zero until real trades are imported.
                    new_holding = Holding(
                        user_id=user_id,
                        asset_id=asset.id,
                        total_quantity=total_qty,
                        available_quantity=free_qty,
                        locked_quantity=locked_qty,
                        average_cost_usd=price or Decimal('0'),
                        total_cost_usd=value or Decimal('0'),
                        current_price_usd=price,
                        current_value_usd=value,
                        unrealized_pnl_usd=Decimal('0'),
                    )
                    db.add(new_holding)
                    created_count += 1

            db.commit()
            
            return {
                "updated_assets": updated_count,
                "created_assets": created_count,
                "total_processed": len(assets),
                "total_value_usd": str(sum((asset['value_usd'] for asset in assets), Decimal('0')))
            }
            
        except Exception as e:
            db.rollback()
            raise e

# Global sync service instance
portfolio_sync_service = AdvancedPortfolioSync()

@router.post("/portfolio/sync", response_model=Dict[str, Any])
async def sync_portfolio(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Trigger comprehensive portfolio sync with Binance
    """
    try:
        result = await portfolio_sync_service.sync_user_portfolio(current_user.id, db)
        log_audit_event(db, current_user.id, "portfolio_sync",
                         f"Portfolio sync for '{current_user.username}': {result.get('message', '')}",
                         entity_type="user", entity_id=current_user.id,
                         success=bool(result.get("success", False)),
                         error_message=None if result.get("success") else str(result.get("message")))
        return result

    except Exception as e:
        logger.error(f"Portfolio sync failed: {str(e)}")
        log_audit_event(db, current_user.id, "portfolio_sync", f"Portfolio sync failed for '{current_user.username}'",
                         entity_type="user", entity_id=current_user.id, success=False, error_message=str(e))
        raise DatabaseError(f"Portfolio sync failed: {str(e)}")

@router.get("/portfolio/sync/status", response_model=Dict[str, Any])
async def get_sync_status(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current sync status for user
    """
    is_syncing = current_user.id in portfolio_sync_service.sync_in_progress
    
    return {
        "success": True,
        "user_id": current_user.id,
        "sync_in_progress": is_syncing,
        "last_sync_at": current_user.last_sync_at.isoformat() if current_user.last_sync_at else None,
        "last_sync_status": current_user.last_sync_status,
        "sync_error_message": current_user.sync_error_message
    }

@router.get("/portfolio/enhanced", response_model=Dict[str, Any])
async def get_enhanced_portfolio(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get enhanced portfolio with categorization and analytics
    """
    try:
        rows = (
            db.query(Holding, Asset.symbol)
            .join(Asset, Holding.asset_id == Asset.id)
            .filter(Holding.user_id == current_user.id)
            .all()
        )

        if not rows:
            return {
                "success": True,
                "message": "No portfolio data found. Run sync first.",
                "portfolios": [],
                "analytics": {}
            }

        # Categorize and analyze
        major_coins = []
        stablecoins = []
        altcoins = []
        others = []
        total_value = Decimal('0')

        for holding, symbol in rows:
            quantity = holding.total_quantity or Decimal('0')
            current_value = holding.current_value_usd or Decimal('0')
            category = categorize_asset(symbol, float(quantity))
            portfolio_data = {
                "symbol": symbol,
                "quantity": quantity,
                "current_price": holding.current_price_usd or Decimal('0'),
                "current_value": current_value,
                "category": category,
                "last_updated": holding.updated_at.isoformat() if holding.updated_at else None
            }

            if category == 'major':
                major_coins.append(portfolio_data)
            elif category == 'stable':
                stablecoins.append(portfolio_data)
            elif category == 'altcoin':
                altcoins.append(portfolio_data)
            else:
                others.append(portfolio_data)

            total_value += current_value

        analytics = {
            "total_value_usd": total_value,
            "asset_counts": {
                "major_coins": len(major_coins),
                "stablecoins": len(stablecoins),
                "altcoins": len(altcoins),
                "others": len(others),
                "total": len(rows)
            },
            "allocation": {
                "major_coins_value": sum((p['current_value'] for p in major_coins), Decimal('0')),
                "stablecoins_value": sum((p['current_value'] for p in stablecoins), Decimal('0')),
                "altcoins_value": sum((p['current_value'] for p in altcoins), Decimal('0')),
                "others_value": sum((p['current_value'] for p in others), Decimal('0'))
            }
        }

        return stringify_decimals({
            "success": True,
            "portfolios": {
                "major_coins": major_coins,
                "stablecoins": stablecoins,
                "altcoins": altcoins,
                "others": others
            },
            "analytics": analytics,
            "last_sync": current_user.last_sync_at.isoformat() if current_user.last_sync_at else None
        })

    except Exception as e:
        logger.error(f"Failed to get enhanced portfolio: {str(e)}")
        raise DatabaseError(f"Failed to get enhanced portfolio: {str(e)}")