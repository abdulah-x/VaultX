from binance.client import Client
from binance.exceptions import BinanceAPIException, BinanceRequestException
import os
import time
import asyncio
import functools
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable
from dotenv import load_dotenv
import logging
from requests.exceptions import RequestException
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

load_dotenv()

# Set up logging for Binance operations
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_sync(func: Callable, *args, **kwargs):
    """Run a blocking (synchronous) call in the default thread-pool executor.

    python-binance is fully synchronous (requests-based) and its rate limiter
    uses time.sleep. Calling it directly from an async handler blocks the whole
    event loop; running it here keeps the loop responsive.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(func, *args, **kwargs))

class BinanceClientManager:
    # Class-level (shared across every instance) so an in-process emergency
    # disable actually takes effect immediately. Every API route constructs a
    # fresh BinanceClientManager() per call - if these lived on `self` instead,
    # emergency_disable() on one instance would be invisible to the very next
    # request's brand-new instance, making the kill-switch a no-op in practice.
    _emergency_disabled = os.getenv('EMERGENCY_DISABLE_BINANCE', 'false').lower() == 'true'
    _maintenance_mode = os.getenv('MAINTENANCE_MODE', 'false').lower() == 'true'

    def __init__(self, api_key: str = None, secret_key: str = None, testnet: bool = None):
        # Credentials default to the process-wide env keys so every existing
        # call site keeps working. Passing them explicitly is how per-user
        # connections are built (see `for_user`), which is what makes multi-user
        # Binance access possible at all — a single shared env key would show
        # every user the same account.
        self.api_key = api_key if api_key is not None else os.getenv('BINANCE_API_KEY')
        self.secret_key = secret_key if secret_key is not None else os.getenv('BINANCE_SECRET_KEY')
        if testnet is not None:
            self.testnet = testnet
        else:
            self.testnet = os.getenv('BINANCE_TESTNET', 'true').lower() == 'true'
        self.client = None
        self.connected = False
        self.last_request_time = 0
        self.request_count = 0
        self.rate_limit_per_minute = int(os.getenv('BINANCE_RATE_LIMIT_PER_MINUTE', '1000'))

        # Validate configuration
        self._validate_config()

    @classmethod
    def for_user(cls, user) -> "BinanceClientManager":
        """Build a manager from a user's own stored credentials.

        Falls back to the env keys when the user hasn't connected an account, so
        existing single-key deployments keep working. Returns None-credentialed
        (and therefore unusable) rather than raising when decryption fails —
        `get_client()` already handles missing credentials, and callers surface
        that as "not connected".
        """
        from core.crypto import decrypt_secret

        encrypted_key = getattr(user, "encrypted_api_key", None)
        encrypted_secret = getattr(user, "encrypted_api_secret", None)
        if not encrypted_key or not encrypted_secret:
            return cls()

        api_key = decrypt_secret(encrypted_key)
        secret_key = decrypt_secret(encrypted_secret)
        if not api_key or not secret_key:
            logger.warning("User %s has unreadable Binance credentials", getattr(user, "id", "?"))
            return cls(api_key="", secret_key="")

        testnet = getattr(user, "binance_testnet", True)
        return cls(api_key=api_key, secret_key=secret_key, testnet=bool(testnet))

    @property
    def emergency_disabled(self) -> bool:
        return BinanceClientManager._emergency_disabled

    @property
    def maintenance_mode(self) -> bool:
        return BinanceClientManager._maintenance_mode

    def _validate_config(self):
        """Validate API key configuration and permissions"""
        if not self.api_key or not self.secret_key:
            logger.error("❌ Binance API keys not configured")
            return False

        if self.api_key == "your_testnet_api_key_here":
            logger.error("❌ Please update BINANCE_API_KEY in .env file")
            return False

        logger.info(f"🔧 Binance Configuration:")
        logger.info(f"   Mode: {'TESTNET' if self.testnet else '🚨 MAINNET'}")
        logger.info(f"   API Key: {self.api_key[:8]}...")
        logger.info(f"   Rate Limit: {self.rate_limit_per_minute}/min")
        logger.info(f"   Emergency Disabled: {self.emergency_disabled}")

        return True

    def _check_emergency_controls(self):
        """Check if emergency controls are activated"""
        if self.emergency_disabled:
            raise Exception("🚨 EMERGENCY: Binance API access is disabled")

        if self.maintenance_mode:
            raise Exception("🔧 MAINTENANCE: Binance API is in maintenance mode")
    
    def _rate_limit_check(self):
        """Implement rate limiting to prevent API abuse"""
        current_time = time.time()
        
        # Reset counter every minute
        if current_time - self.last_request_time > 60:
            self.request_count = 0
            self.last_request_time = current_time
        
        self.request_count += 1
        
        if self.request_count > self.rate_limit_per_minute:
            wait_time = 60 - (current_time - self.last_request_time)
            logger.warning(f"⏰ Rate limit reached. Waiting {wait_time:.1f}s")
            time.sleep(wait_time)
            self.request_count = 1
            self.last_request_time = time.time()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=6),
        # Only network/transient failures - a bad API key or invalid config
        # raises before this point (_validate_config) or as a different
        # exception type, so it isn't retried here.
        retry=retry_if_exception_type((BinanceRequestException, RequestException, ConnectionError, TimeoutError)),
        reraise=True,
    )
    def _connect_once(self):
        self.client = Client(
            self.api_key,
            self.secret_key,
            testnet=self.testnet
        )
        # Test connection and validate permissions
        self._validate_permissions()

    def connect(self):
        """Initialize Binance client connection with enhanced security"""
        try:
            # Check emergency controls
            self._check_emergency_controls()

            if not self._validate_config():
                return False

            logger.info(f"🔌 Connecting to Binance {'Testnet' if self.testnet else 'Mainnet'}...")

            self._connect_once()

            self.connected = True
            logger.info(f"✅ Connected to Binance {'Testnet' if self.testnet else 'Mainnet'}")
            return True

        except Exception as e:
            logger.error(f"❌ Binance connection failed: {e}")
            self.connected = False
            return False
    
    def _validate_permissions(self):
        """Validate API key permissions (READ-ONLY expected)"""
        try:
            account_info = self.client.get_account()
            
            can_trade = account_info.get('canTrade', False)
            can_withdraw = account_info.get('canWithdraw', False)
            can_deposit = account_info.get('canDeposit', True)
            
            logger.info(f"🔐 API Permissions:")
            logger.info(f"   Can Trade: {can_trade}")
            logger.info(f"   Can Withdraw: {can_withdraw}")
            logger.info(f"   Can Deposit: {can_deposit}")
            
            # Warning for production safety
            if can_trade:
                logger.warning("⚠️  WARNING: API key has TRADING permissions!")
            if can_withdraw:
                logger.warning("🚨 CRITICAL: API key has WITHDRAWAL permissions!")
                
            return account_info
            
        except Exception as e:
            logger.error(f"❌ Permission validation failed: {e}")
            raise
    
    def get_client(self) -> Optional[Client]:
        """Get the Binance client instance with safety checks"""
        try:
            # Check emergency controls
            self._check_emergency_controls()
            
            # Apply rate limiting
            self._rate_limit_check()
            
            if not self.connected or not self.client:
                if not self.connect():
                    return None
            
            return self.client
            
        except Exception as e:
            logger.error(f"❌ Client access failed: {e}")
            return None
    
    def get_connection_status(self) -> Dict[str, Any]:
        """Get detailed connection status"""
        return {
            "connected": self.connected,
            "testnet": self.testnet,
            "emergency_disabled": self.emergency_disabled,
            "maintenance_mode": self.maintenance_mode,
            "rate_limit": f"{self.request_count}/{self.rate_limit_per_minute}",
            "api_key_configured": bool(self.api_key and self.api_key != "your_testnet_api_key_here")
        }
    
    @classmethod
    def emergency_disable(cls):
        """Emergency disable Binance API access - takes effect for every
        instance immediately, including ones already constructed, since the
        flag is class-level state rather than per-instance."""
        cls._emergency_disabled = True
        logger.critical("🚨 EMERGENCY: Binance API access DISABLED")

    @classmethod
    def emergency_enable(cls):
        """Clear the in-process emergency disable."""
        cls._emergency_disabled = False
        logger.warning("Binance API access RE-ENABLED")