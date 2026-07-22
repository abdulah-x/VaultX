"""
Symmetric encryption for per-user secrets at rest — currently Binance API keys.

Uses Fernet (AES-128-CBC + HMAC) from `cryptography`, which is already a
dependency for python-jose, so this adds no new package.

The key comes from CREDENTIAL_ENCRYPTION_KEY. It is deliberately *not* derived
from SECRET_KEY: rotating the JWT signing key is a routine operation (it only
invalidates live sessions), whereas rotating this one makes every stored API
credential permanently unreadable. Tying them together would turn a cheap
rotation into a destructive one.
"""
import base64
import hashlib
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

# The key lives in backend/.env, which docker-compose does not inject (listing it
# there would shadow the real value with an empty one). Load it the same way
# core/redis_client.py does rather than relying on import order elsewhere.
load_dotenv()

logger = logging.getLogger(__name__)

_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    """Lazily build the Fernet instance from the configured key.

    Accepts either a proper 32-byte urlsafe-base64 Fernet key, or any passphrase
    (hashed to 32 bytes) so local setup doesn't require generating one first.
    """
    global _fernet
    if _fernet is not None:
        return _fernet

    raw = os.getenv("CREDENTIAL_ENCRYPTION_KEY")
    if not raw:
        raise RuntimeError(
            "CREDENTIAL_ENCRYPTION_KEY is not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        )

    try:
        _fernet = Fernet(raw.encode())
    except (ValueError, TypeError):
        # Not a valid Fernet key — treat it as a passphrase.
        digest = hashlib.sha256(raw.encode()).digest()
        _fernet = Fernet(base64.urlsafe_b64encode(digest))

    return _fernet


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a secret for storage. Returns urlsafe-base64 ciphertext."""
    if not plaintext:
        raise ValueError("Cannot encrypt an empty secret")
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> Optional[str]:
    """Decrypt a stored secret, or None if it can't be read.

    Returns None rather than raising when the ciphertext doesn't match the
    current key — that happens after a key rotation, and callers should treat it
    as "no credentials configured" and prompt the user to reconnect, not crash.
    """
    if not ciphertext:
        return None
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError, TypeError):
        logger.warning("Stored credential could not be decrypted (key rotated?)")
        return None


def mask_key(value: str, visible: int = 4) -> str:
    """Render an API key for display without exposing it: 'W5ga…9Xb2'."""
    if not value:
        return ""
    if len(value) <= visible * 2:
        return "…"
    return f"{value[:visible]}…{value[-visible:]}"
