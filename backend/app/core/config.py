from pydantic_settings import BaseSettings
from typing import Optional, List
import os

# Sentinel: the insecure default secret shipped with the repo. If this value is
# still in use outside of DEBUG mode we refuse to start (see below).
DEFAULT_INSECURE_SECRET = "your-super-secret-key-change-this-in-production"

class Settings(BaseSettings):
    # App Configuration
    app_name: str = "Crypto Portfolio API"
    version: str = "1.0.0"
    debug: bool = True
    
    # Server Configuration
    host: str = "127.0.0.1"
    port: int = 8000
    
    # Database Configuration
    database_url: str = "sqlite:///./crypto_portfolio.db"
    
    # Security Configuration
    secret_key: str = DEFAULT_INSECURE_SECRET
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Comma-separated list of emails allowed to hit privileged (admin) routes,
    # e.g. database backup/restore. Empty by default = nobody has access.
    admin_emails: str = ""
    
    # Binance API Configuration
    binance_api_key: Optional[str] = None
    binance_secret_key: Optional[str] = None
    binance_testnet: bool = True
    
    # Redis Configuration
    redis_url: str = "redis://localhost:6379/0"
    
    # Email Configuration (for OTP)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None  # Use App Password for Gmail
    smtp_from_email: Optional[str] = None
    smtp_from_name: str = "VaultX Crypto Portfolio"

    # Public URL of the frontend, used to build links in emails
    # (password reset, verification, etc.). Keep in sync with the port the
    # frontend is actually served on (3100 under Docker Compose).
    frontend_url: str = "http://localhost:3100"

    # Google OAuth
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: Optional[str] = None

    # Google Gemini (LLM Portfolio Advisor) - server-side only, never exposed to the frontend
    gemini_api_key: Optional[str] = None

    # Security Settings
    enable_api_encryption: bool = True
    allowed_ips: str = "localhost,127.0.0.1"
    
    # Rate Limiting
    api_rate_limit_per_minute: int = 60
    binance_rate_limit_per_minute: int = 1000
    
    # Emergency Controls
    emergency_disable_binance: bool = False
    maintenance_mode: bool = False
    
    # CORS Configuration
    allowed_origins: list = ["http://localhost:3100", "http://127.0.0.1:3100"]

    @property
    def admin_email_list(self) -> List[str]:
        """Normalized, lower-cased list of admin emails."""
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()

# Fail fast on the shipped insecure secret, regardless of DEBUG. DEBUG defaults to
# true in docker-compose.yml/.env.example, so gating this on DEBUG=false would make
# it dead code in the exact configuration this repo ships — JWTs would be silently
# signed with a public, repo-visible constant. An explicit opt-in is required to
# run with the default secret at all (e.g. quick local experimentation).
if settings.secret_key == DEFAULT_INSECURE_SECRET and os.getenv("ALLOW_INSECURE_SECRET", "").lower() != "true":
    raise RuntimeError(
        "SECRET_KEY is still set to the insecure default. Set a strong SECRET_KEY "
        "environment variable, or set ALLOW_INSECURE_SECRET=true to explicitly opt "
        "into running with it (not recommended outside throwaway local testing)."
    )