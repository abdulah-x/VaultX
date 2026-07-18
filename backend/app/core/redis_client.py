"""
Redis client for token blacklisting and caching
"""
import redis
import json
from typing import Optional, Any
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

class RedisClient:
    """Redis client for token blacklisting and session management"""
    
    def __init__(self):
        # Use Redis URL from environment or default to local Redis
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        
        try:
            # Try to connect to Redis
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self.redis_client.ping()
            self.connected = True
            print("✅ Redis connected for token blacklisting")
        except (redis.ConnectionError, redis.TimeoutError) as e:
            print(f"⚠️  Redis not available: {e}")
            print("🔄 Falling back to in-memory token blacklist")
            self.redis_client = None
            self.connected = False
            # Fallback to in-memory storage
            self._memory_blacklist = set()
    
    def blacklist_token(self, token: str, expires_in_seconds: int) -> bool:
        """
        Add token to blacklist with expiration
        
        Args:
            token: JWT token to blacklist
            expires_in_seconds: How long to keep the token blacklisted
            
        Returns:
            bool: True if successfully blacklisted
        """
        try:
            if self.connected:
                # Store in Redis with expiration
                key = f"blacklist:{token}"
                return self.redis_client.setex(key, expires_in_seconds, "blacklisted")
            else:
                # Fallback to in-memory storage
                self._memory_blacklist.add(token)
                return True
        except Exception as e:
            print(f"❌ Error blacklisting token: {e}")
            return False
    
    def is_token_blacklisted(self, token: str) -> bool:
        """
        Check if token is blacklisted
        
        Args:
            token: JWT token to check
            
        Returns:
            bool: True if token is blacklisted
        """
        try:
            if self.connected:
                key = f"blacklist:{token}"
                return self.redis_client.exists(key) == 1
            else:
                # Check in-memory storage
                return token in self._memory_blacklist
        except Exception as e:
            print(f"❌ Error checking token blacklist: {e}")
            # Fail CLOSED: if we can't confirm a token is *not* revoked (e.g. Redis
            # is briefly unreachable), treat it as blacklisted so a logged-out or
            # revoked token can't be replayed during the outage. The caller turns
            # this into a 401, forcing a fresh login rather than silently trusting
            # a token whose revocation state is unknown.
            return True
    
    # ---- OTP storage (email verification / registration codes) ----

    def store_otp(self, email: str, otp: str, expires_in_seconds: int = 600, max_attempts: int = 3) -> bool:
        """Store an OTP for an email with an expiry and attempt counter.

        The attempt counter lives in its own key (see verify_otp) so it can be
        incremented atomically via Redis INCR, rather than embedded in this
        JSON payload and updated via a non-atomic GET-then-SETEX.
        """
        payload = json.dumps({"otp": otp, "max_attempts": max_attempts})
        try:
            if self.connected:
                # Clear any leftover attempt counter from a previous OTP for
                # this email before the new one starts accumulating attempts.
                self.redis_client.delete(f"otp_attempts:{email}")
                return bool(self.redis_client.setex(f"otp:{email}", expires_in_seconds, payload))
            # in-memory fallback
            if not hasattr(self, "_memory_otp"):
                self._memory_otp = {}
            self._memory_otp[email] = {
                "otp": otp,
                "attempts": 0,
                "max_attempts": max_attempts,
                "expires_at": datetime.utcnow() + timedelta(seconds=expires_in_seconds),
            }
            return True
        except Exception as e:
            print(f"❌ Error storing OTP: {e}")
            return False

    def verify_otp(self, email: str, otp: str) -> tuple[bool, str]:
        """Verify an OTP, enforcing expiry and a max-attempts limit.

        The attempt count is tracked via Redis INCR (atomic even under
        concurrent requests) instead of a read-modify-write on the OTP's own
        JSON blob, which let concurrent guesses race past max_attempts.
        """
        try:
            if self.connected:
                key = f"otp:{email}"
                attempts_key = f"otp_attempts:{email}"
                raw = self.redis_client.get(key)
                if not raw:
                    return False, "No OTP found or it has expired"
                data = json.loads(raw)
                max_attempts = data["max_attempts"]

                attempts = self.redis_client.incr(attempts_key)
                if attempts == 1:
                    ttl = self.redis_client.ttl(key)
                    self.redis_client.expire(attempts_key, ttl if ttl and ttl > 0 else 600)
                if attempts > max_attempts:
                    self.redis_client.delete(key, attempts_key)
                    return False, "Too many failed attempts"

                if data["otp"] == otp:
                    self.redis_client.delete(key, attempts_key)
                    return True, "OTP verified successfully"
                return False, f"Invalid OTP. {max_attempts - attempts} attempts remaining"

            # in-memory fallback
            store = getattr(self, "_memory_otp", {})
            data = store.get(email)
            if not data:
                return False, "No OTP found or it has expired"
            if datetime.utcnow() > data["expires_at"]:
                store.pop(email, None)
                return False, "OTP has expired"
            if data["otp"] == otp:
                store.pop(email, None)
                return True, "OTP verified successfully"
            data["attempts"] += 1
            if data["attempts"] >= data["max_attempts"]:
                store.pop(email, None)
                return False, "Too many failed attempts"
            return False, f"Invalid OTP. {data['max_attempts'] - data['attempts']} attempts remaining"
        except Exception as e:
            print(f"❌ Error verifying OTP: {e}")
            return False, "OTP verification error"

    def cleanup_expired_tokens(self):
        """
        Clean up expired tokens (Redis handles this automatically)
        For in-memory storage, we rely on token natural expiration
        """
        if not self.connected:
            # For in-memory storage, we could implement cleanup here
            # but for simplicity, we'll rely on application restart
            pass
    
    def get_blacklist_stats(self) -> dict:
        """Get statistics about blacklisted tokens"""
        try:
            if self.connected:
                blacklist_keys = self.redis_client.keys("blacklist:*")
                return {
                    "blacklisted_tokens": len(blacklist_keys),
                    "storage": "redis",
                    "connected": True
                }
            else:
                return {
                    "blacklisted_tokens": len(self._memory_blacklist),
                    "storage": "memory",
                    "connected": False
                }
        except Exception as e:
            return {
                "error": str(e),
                "blacklisted_tokens": 0,
                "storage": "unknown",
                "connected": False
            }

# Global Redis client instance
redis_client = RedisClient()