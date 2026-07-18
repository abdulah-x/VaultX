"""
Binance API testing endpoints for testnet integration
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from decimal import Decimal

from core.dependencies import get_db, get_current_active_user, require_admin
from core.errors import DatabaseError, ValidationError
from database.models import User
from services.binance.client import BinanceClientManager
from services.binance.account import BinanceAccountService

router = APIRouter()

@router.get("/binance/status", response_model=Dict[str, Any])
async def get_binance_status(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get Binance API connection status and configuration
    """
    try:
        client_manager = BinanceClientManager()
        status = client_manager.get_connection_status()
        
        return {
            "success": True,
            "status": status,
            "message": "Binance status retrieved successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get Binance status: {str(e)}")

@router.post("/binance/test-connection", response_model=Dict[str, Any])
async def test_binance_connection(
    current_user: User = Depends(get_current_active_user)
):
    """
    Test Binance API connection and validate permissions
    """
    try:
        client_manager = BinanceClientManager()
        
        # Test connection
        connected = client_manager.connect()
        
        if not connected:
            return {
                "success": False,
                "message": "Failed to connect to Binance API",
                "connected": False
            }
        
        # Get client and test basic functionality
        client = client_manager.get_client()
        if not client:
            return {
                "success": False,
                "message": "Failed to get Binance client",
                "connected": False
            }
        
        # Test account access
        account_info = client.get_account()
        
        return {
            "success": True,
            "connected": True,
            "testnet": client_manager.testnet,
            "account_type": account_info.get('accountType'),
            "permissions": {
                "can_trade": account_info.get('canTrade', False),
                "can_withdraw": account_info.get('canWithdraw', False),
                "can_deposit": account_info.get('canDeposit', False)
            },
            "message": f"Successfully connected to Binance {'Testnet' if client_manager.testnet else 'Mainnet'}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "connected": False,
            "error": str(e),
            "message": "Binance connection test failed"
        }

@router.get("/binance/account", response_model=Dict[str, Any])
async def get_binance_account_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get Binance account information (testnet)
    """
    try:
        account_service = BinanceAccountService()
        account_info = account_service.get_account_info()
        
        if not account_info:
            raise HTTPException(status_code=500, detail="Failed to get account information")
        
        return {
            "success": True,
            "account": account_info,
            "message": "Account information retrieved successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get account info: {str(e)}")

@router.get("/binance/balances", response_model=Dict[str, Any]) 
async def get_binance_balances(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get Binance account balances (testnet)
    """
    try:
        account_service = BinanceAccountService()
        balances = account_service.get_balances()
        
        return {
            "success": True,
            "balances": balances,
            "total_assets": len(balances),
            "message": "Balances retrieved successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get balances: {str(e)}")

@router.get("/binance/test-data", response_model=Dict[str, Any])
async def get_test_data_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get information about testnet test data and how to get more
    """
    return {
        "success": True,
        "testnet_info": {
            "faucet_url": "https://testnet.binance.vision/",
            "description": "Get free test funds from the Binance Testnet faucet",
            "available_assets": ["BTC", "ETH", "BNB", "USDT", "ADA", "DOT"],
            "instructions": [
                "1. Go to https://testnet.binance.vision/",
                "2. Login with your testnet account", 
                "3. Navigate to 'Faucet' section",
                "4. Request test funds for different cryptocurrencies",
                "5. Use these funds to test portfolio tracking"
            ]
        },
        "message": "Testnet information retrieved successfully" 
    }

@router.post("/binance/emergency-disable", response_model=Dict[str, Any])
async def emergency_disable_binance(
    current_user: User = Depends(require_admin)
):
    """
    Emergency disable Binance API access (admin only). Flips a class-level
    flag shared by every BinanceClientManager instance app-wide, so it takes
    effect immediately for all future calls without needing a restart.
    """
    try:
        BinanceClientManager.emergency_disable()

        return {
            "success": True,
            "message": "🚨 EMERGENCY: Binance API access has been DISABLED",
            "disabled": True
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Emergency disable failed: {str(e)}")

@router.post("/binance/emergency-enable", response_model=Dict[str, Any])
async def emergency_enable_binance(
    current_user: User = Depends(require_admin)
):
    """Re-enable Binance API access after an emergency disable (admin only)."""
    try:
        BinanceClientManager.emergency_enable()

        return {
            "success": True,
            "message": "Binance API access has been RE-ENABLED",
            "disabled": False
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Emergency enable failed: {str(e)}")

@router.get("/binance/prices/{symbol}", response_model=Dict[str, Any])
async def get_symbol_price(
    symbol: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current price for a trading symbol (testnet)
    """
    try:
        client_manager = BinanceClientManager()
        client = client_manager.get_client()
        
        if not client:
            raise HTTPException(status_code=500, detail="Binance client not available")
        
        # Get current price
        ticker = client.get_symbol_ticker(symbol=symbol.upper())
        
        return {
            "success": True,
            "symbol": symbol.upper(),
            "price": float(ticker['price']),
            "testnet": client_manager.testnet,
            "message": f"Price for {symbol.upper()} retrieved successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get price: {str(e)}")

@router.get("/binance/test", response_model=Dict[str, Any])
async def test_binance_api(
    current_user: User = Depends(get_current_active_user)
):
    """
    Test Binance API connection - frontend compatibility endpoint
    Alias for /binance/status
    """
    return await get_binance_status(current_user)