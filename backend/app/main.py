from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from binance.exceptions import BinanceAPIException
from datetime import datetime
import asyncio
import uvicorn
import sys
import os
import uuid

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.config import settings
from core.errors import (
    APIError, api_error_handler, validation_error_handler,
    http_exception_handler, database_error_handler, 
    binance_error_handler, general_exception_handler
)

# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="A comprehensive crypto portfolio management API with JWT authentication",
    debug=settings.debug
)

# Add request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID to each request"""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Import and include API routers
from api.auth import router as auth_router
from api.portfolio import router as portfolio_router
from api.trades import router as trades_router
from api.pnl import router as pnl_router
from api.binance_test import router as binance_test_router

# Import advanced features with error handling
try:
    from api.portfolio_sync import router as portfolio_sync_router
    PORTFOLIO_SYNC_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Portfolio Sync import failed: {e}")
    PORTFOLIO_SYNC_AVAILABLE = False

try:
    from api.trade_import import router as trade_import_router
    TRADE_IMPORT_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Trade Import import failed: {e}")
    TRADE_IMPORT_AVAILABLE = False

try:
    from api.realtime_prices import router as realtime_prices_router
    REALTIME_PRICES_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Real-time Prices import failed: {e}")
    REALTIME_PRICES_AVAILABLE = False

try:
    from api.advanced_pnl import router as advanced_pnl_router
    ADVANCED_PNL_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Advanced P&L import failed: {e}")
    ADVANCED_PNL_AVAILABLE = False

try:
    from api.backup import router as backup_router
    BACKUP_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Backup routes import failed: {e}")
    BACKUP_AVAILABLE = False

try:
    from api.google_auth import router as google_auth_router
    GOOGLE_AUTH_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Google OAuth routes import failed: {e}")
    GOOGLE_AUTH_AVAILABLE = False

try:
    from api.password_reset import router as password_reset_router
    PASSWORD_RESET_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Password Reset routes import failed: {e}")
    PASSWORD_RESET_AVAILABLE = False

try:
    from api.email_verification import router as email_verification_router
    EMAIL_VERIFICATION_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Email Verification routes import failed: {e}")
    EMAIL_VERIFICATION_AVAILABLE = False

try:
    from api.advisor import router as advisor_router
    ADVISOR_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Portfolio Advisor routes import failed: {e}")
    ADVISOR_AVAILABLE = False

try:
    from api.market_data import router as market_data_router
    MARKET_DATA_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Market Data routes import failed: {e}")
    MARKET_DATA_AVAILABLE = False

try:
    from api.orders import router as orders_router
    ORDERS_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Orders routes import failed: {e}")
    ORDERS_AVAILABLE = False

try:
    from api.portfolio_analytics import router as portfolio_analytics_router
    PORTFOLIO_ANALYTICS_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Portfolio Analytics routes import failed: {e}")
    PORTFOLIO_ANALYTICS_AVAILABLE = False

# Include API routes.
#
# IMPORTANT ordering rule: the trades and pnl routers contain greedy catch-all
# routes (`/trades/{symbol}`, `/pnl/{symbol}`). FastAPI matches routes in
# registration order across all routers, so those catch-alls would swallow the
# static sub-paths declared in the advanced routers (e.g. `/pnl/comprehensive`,
# `/trades/analysis`). We therefore register auth/portfolio + all advanced
# feature routers FIRST, and the catch-all-bearing trades/pnl routers LAST.
app.include_router(auth_router, prefix="/api", tags=["Authentication"])
app.include_router(portfolio_router, prefix="/api", tags=["Portfolio"])
app.include_router(binance_test_router, prefix="/api", tags=["Binance Testing"])

# Include advanced features if available (before the catch-all routers)
if PASSWORD_RESET_AVAILABLE:
    app.include_router(password_reset_router, prefix="/api", tags=["Password Reset"])
    print("✅ Password Reset routes registered")

if EMAIL_VERIFICATION_AVAILABLE:
    app.include_router(email_verification_router, prefix="/api", tags=["Email Verification"])
    print("✅ Email Verification routes registered")

if PORTFOLIO_SYNC_AVAILABLE:
    app.include_router(portfolio_sync_router, prefix="/api", tags=["Portfolio Sync"])
    print("✅ Portfolio Sync routes registered")

if TRADE_IMPORT_AVAILABLE:
    app.include_router(trade_import_router, prefix="/api", tags=["Trade Import"])
    print("✅ Trade Import routes registered")

if REALTIME_PRICES_AVAILABLE:
    app.include_router(realtime_prices_router, prefix="/api", tags=["Real-time Prices"])
    print("✅ Real-time Prices routes registered")

if ADVANCED_PNL_AVAILABLE:
    app.include_router(advanced_pnl_router, prefix="/api", tags=["Advanced P&L"])
    print("✅ Advanced P&L routes registered")

if ADVISOR_AVAILABLE:
    app.include_router(advisor_router, prefix="/api", tags=["Advisor"])
    print("✅ Portfolio Advisor routes registered")

if MARKET_DATA_AVAILABLE:
    app.include_router(market_data_router, prefix="/api", tags=["Market Data"])
    print("✅ Market Data routes registered")

if ORDERS_AVAILABLE:
    app.include_router(orders_router, prefix="/api", tags=["Orders"])
    print("✅ Orders routes registered")

if PORTFOLIO_ANALYTICS_AVAILABLE:
    app.include_router(portfolio_analytics_router, prefix="/api", tags=["Portfolio Analytics"])
    print("✅ Portfolio Analytics routes registered")

if BACKUP_AVAILABLE:
    app.include_router(backup_router, tags=["Backup & Restore"])
    print("✅ Backup & Restore routes registered")

if GOOGLE_AUTH_AVAILABLE:
    app.include_router(google_auth_router, tags=["Google OAuth"])
    print("✅ Google OAuth routes registered")

# Catch-all-bearing routers LAST so their `/{symbol}` routes don't shadow the
# static advanced routes above.
app.include_router(trades_router, prefix="/api", tags=["Trades"])
app.include_router(pnl_router, prefix="/api", tags=["P&L"])

# Start the live price ingestion pipeline (Phase 6) alongside the API. This
# replaces the old REST-polling simulation in realtime_prices.py — real
# Binance WS ticks now flow to Redis Streams -> the stream-writer service ->
# price_history/CurrentPrice.
async def _supervised_stream_ticks():
    """Keep the ingestion task alive forever.

    stream_binance_ticks() already retries connection/stream drops internally
    (tenacity, in live_stream.py), but anything that raises *before* that
    retry-wrapped section (e.g. Redis unreachable at the ensure_group() call)
    would otherwise propagate out of this asyncio task and silently end
    ingestion for good - nothing awaits this task, so the exception would only
    ever surface as an easy-to-miss "Task exception was never retrieved" log.
    """
    from data_pipeline.live_stream import stream_binance_ticks
    while True:
        try:
            await stream_binance_ticks()
            # A clean return (e.g. BINANCE_API_KEY not configured) is a
            # deliberate no-op, not a crash - don't spin-restart it.
            return
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"⚠️ Live price ingestion task crashed, restarting in 5s: {e}")
            await asyncio.sleep(5)


@app.on_event("startup")
async def start_background_tasks():
    if REALTIME_PRICES_AVAILABLE:
        try:
            asyncio.create_task(_supervised_stream_ticks())
            print("✅ Live price ingestion task started")
        except Exception as e:
            print(f"⚠️ Live price ingestion failed to start: {e}")

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint to verify API and all features
    """
    # Check database connectivity
    try:
        from database.connection import SessionLocal
        from sqlalchemy import text
        db_session = SessionLocal()
        # Simple query to test DB
        db_session.execute(text("SELECT 1"))
        db_session.close()
        db_status = "healthy"
        db_error = None
    except Exception as e:
        db_status = "unhealthy"
        db_error = str(e)
    
    # Check Binance API key configuration (if available). This intentionally does
    # NOT make a live Binance API call: /health is polled every 10s by Docker's
    # healthcheck, and a real connect()+get_account() round trip here would hammer
    # Binance continuously and block the event loop. Use /api/binance/test-connection
    # for an actual live connectivity check.
    binance_status = "not_configured"
    binance_error = None
    try:
        from services.binance.client import BinanceClientManager
        client = BinanceClientManager()
        has_valid_key = bool(
            client.api_key and client.secret_key
            and client.api_key != "your_testnet_api_key_here"
        )
        binance_status = "healthy" if has_valid_key else "not_configured"
    except Exception as e:
        binance_status = "unhealthy"
        binance_error = str(e)
    
    # Advanced features health
    features_health = {
        "portfolio_sync": {
            "available": PORTFOLIO_SYNC_AVAILABLE,
            "status": "healthy" if PORTFOLIO_SYNC_AVAILABLE else "unavailable"
        },
        "trade_import": {
            "available": TRADE_IMPORT_AVAILABLE,
            "status": "healthy" if TRADE_IMPORT_AVAILABLE else "unavailable"
        },
        "realtime_prices": {
            "available": REALTIME_PRICES_AVAILABLE,
            "status": "healthy" if REALTIME_PRICES_AVAILABLE else "unavailable"
        },
        "advanced_pnl": {
            "available": ADVANCED_PNL_AVAILABLE,
            "status": "healthy" if ADVANCED_PNL_AVAILABLE else "unavailable"
        },
        "advisor": {
            "available": ADVISOR_AVAILABLE,
            "status": "healthy" if ADVISOR_AVAILABLE else "unavailable"
        },
        "market_data": {
            "available": MARKET_DATA_AVAILABLE,
            "status": "healthy" if MARKET_DATA_AVAILABLE else "unavailable"
        },
        "orders": {
            "available": ORDERS_AVAILABLE,
            "status": "healthy" if ORDERS_AVAILABLE else "unavailable"
        },
        "portfolio_analytics": {
            "available": PORTFOLIO_ANALYTICS_AVAILABLE,
            "status": "healthy" if PORTFOLIO_ANALYTICS_AVAILABLE else "unavailable"
        },
        "backup": {
            "available": BACKUP_AVAILABLE,
            "status": "healthy" if BACKUP_AVAILABLE else "unavailable"
        },
        "google_auth": {
            "available": GOOGLE_AUTH_AVAILABLE,
            "status": "healthy" if GOOGLE_AUTH_AVAILABLE else "unavailable"
        },
        "password_reset": {
            "available": PASSWORD_RESET_AVAILABLE,
            "status": "healthy" if PASSWORD_RESET_AVAILABLE else "unavailable"
        },
        "email_verification": {
            "available": EMAIL_VERIFICATION_AVAILABLE,
            "status": "healthy" if EMAIL_VERIFICATION_AVAILABLE else "unavailable"
        }
    }
    
    # Overall status
    overall_healthy = (
        db_status == "healthy" and
        binance_status in ["healthy", "not_configured"] and
        all(f["status"] in ["healthy", "unavailable"] for f in features_health.values())
    )
    
    return {
        "status": "healthy" if overall_healthy else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.version,
        "app_name": settings.app_name,
        "components": {
            "database": {
                "status": db_status,
                "error": db_error
            },
            "binance_api": {
                "status": binance_status,
                "error": binance_error
            },
            "advanced_features": features_health
        },
        "summary": {
            "total_features": len(features_health),
            "available_features": sum(1 for f in features_health.values() if f["available"]),
            "healthy_components": sum(1 for status in [db_status, binance_status] if status == "healthy")
        }
    }

# Root endpoint
@app.get("/")
async def root():
    """
    Root endpoint with API information
    """
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.version,
        "docs": "/docs",
        "health": "/health"
    }

# API Info endpoint
@app.get("/api/info")
async def api_info():
    """
    Get API information and available endpoints
    """
    # Core endpoints
    core_endpoints = {
        "health": "/health",
        "docs": "/docs",
        "redoc": "/redoc",
        "auth": "/api/auth",
        "portfolio": "/api/portfolio",
        "trades": "/api/trades", 
        "pnl": "/api/pnl",
        "binance_test": "/api/binance-test"
    }
    
    # Advanced features endpoints
    advanced_endpoints = {}
    
    if PORTFOLIO_SYNC_AVAILABLE:
        advanced_endpoints["portfolio_sync"] = {
            "sync": "/api/portfolio/sync",
            "sync_status": "/api/portfolio/sync/status",
            "enhanced_view": "/api/portfolio/enhanced"
        }
    
    if TRADE_IMPORT_AVAILABLE:
        advanced_endpoints["trade_import"] = {
            "import": "/api/trades/import",
            "analysis": "/api/trades/analysis", 
            "import_status": "/api/trades/import/status"
        }
        
    if REALTIME_PRICES_AVAILABLE:
        advanced_endpoints["realtime_prices"] = {
            "websocket_stream": "/api/prices/stream",
            "current_prices": "/api/prices/current",
            "stream_status": "/api/prices/stream/status",
            "portfolio_watch": "/api/prices/portfolio-watch"
        }
        
    if ADVANCED_PNL_AVAILABLE:
        advanced_endpoints["advanced_pnl"] = {
            "comprehensive": "/api/pnl/comprehensive",
            "summary": "/api/pnl/summary",
            "performance": "/api/pnl/performance"
        }

    if ADVISOR_AVAILABLE:
        advanced_endpoints["advisor"] = {
            "chat": "/api/advisor/chat"
        }

    if MARKET_DATA_AVAILABLE:
        advanced_endpoints["market_data"] = {
            "orderbook": "/api/market/orderbook/{symbol}",
            "klines": "/api/market/klines/{symbol}",
            "ticker": "/api/market/ticker/{symbol}"
        }

    if ORDERS_AVAILABLE:
        advanced_endpoints["orders"] = {
            "place": "/api/orders",
            "open": "/api/orders/open",
            "history": "/api/orders/history"
        }

    if PORTFOLIO_ANALYTICS_AVAILABLE:
        advanced_endpoints["portfolio_analytics"] = {
            "optimize": "/api/portfolio/optimize"
        }

    return {
        "app_name": settings.app_name,
        "version": settings.version,
        "debug_mode": settings.debug,
        "status": "All systems operational",
        "features": {
            "core_api": bool(len(core_endpoints)),
            "portfolio_sync": PORTFOLIO_SYNC_AVAILABLE,
            "trade_import": TRADE_IMPORT_AVAILABLE,
            "realtime_prices": REALTIME_PRICES_AVAILABLE,
            "advanced_pnl": ADVANCED_PNL_AVAILABLE
        },
        "endpoints": {
            "core": core_endpoints,
            "advanced": advanced_endpoints
        }
    }

# Register error handlers
app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_error_handler)
app.add_exception_handler(BinanceAPIException, binance_error_handler)
app.add_exception_handler(Exception, general_exception_handler)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info" if not settings.debug else "debug"
    )