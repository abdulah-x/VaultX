#!/usr/bin/env python3
"""
Connect a Binance account — per-user API credentials.

Binance has no public OAuth for third-party sign-in (their OAuth 2.0 is gated to
approved business partners), so "Connect Binance" is a post-login step where the
user supplies their own API key pair rather than a login provider.

Credentials are validated against Binance before being stored, encrypted at rest
via `core.crypto`, and never returned to the client — only a masked preview.

Read-only keys are strongly recommended and enforced by default: a key with
withdrawal permission enabled is rejected unless the caller explicitly opts in,
because a stored key that can move funds turns a database leak into a theft.
"""
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.audit import log_audit_event
from core.crypto import encrypt_secret, decrypt_secret, mask_key
from core.dependencies import get_current_active_user, get_db
from core.errors import ValidationError
from database.models import User
from services.binance.client import BinanceClientManager, run_sync

router = APIRouter()
logger = logging.getLogger(__name__)


class BinanceConnectRequest(BaseModel):
    api_key: str = Field(..., min_length=16, description="Binance API key")
    api_secret: str = Field(..., min_length=16, description="Binance API secret")
    testnet: bool = Field(True, description="Whether these are testnet keys")
    allow_withdrawals: bool = Field(
        False,
        description="Permit storing a key that has withdrawal rights (not recommended)",
    )


@router.post("/binance/connect", response_model=Dict[str, Any])
async def connect_binance(
    payload: BinanceConnectRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Validate and store the caller's own Binance API credentials."""
    manager = BinanceClientManager(
        api_key=payload.api_key, secret_key=payload.api_secret, testnet=payload.testnet
    )
    client = manager.get_client()
    if not client:
        raise ValidationError("Could not initialise a Binance client with those credentials.")

    # Prove the keys work before persisting them — storing credentials we've
    # never successfully used just defers the error to the first sync.
    try:
        account = await run_sync(client.get_account)
    except Exception as e:
        logger.warning("Binance connect failed for user %s: %s", current_user.id, e)
        log_audit_event(
            db, current_user.id, "binance_connect", "Binance connect failed: credentials rejected",
            entity_type="user", entity_id=current_user.id, success=False, error_message=str(e),
        )
        raise ValidationError(
            "Binance rejected those credentials. Check the key, the secret, and "
            "whether the testnet setting matches where the key was created."
        )

    permissions = account.get("permissions") or []
    can_withdraw = bool(account.get("canWithdraw"))

    if can_withdraw and not payload.allow_withdrawals:
        log_audit_event(
            db, current_user.id, "binance_connect", "Binance connect refused: key allows withdrawals",
            entity_type="user", entity_id=current_user.id, success=False, error_message="withdrawal_enabled",
        )
        raise ValidationError(
            "That API key has withdrawal permissions enabled. Create a read-only "
            "key instead, or resend with allow_withdrawals=true if you understand "
            "the risk."
        )

    current_user.encrypted_api_key = encrypt_secret(payload.api_key)
    current_user.encrypted_api_secret = encrypt_secret(payload.api_secret)
    current_user.binance_testnet = payload.testnet
    db.commit()

    log_audit_event(
        db, current_user.id, "binance_connect", "Binance account connected",
        entity_type="user", entity_id=current_user.id,
    )

    return {
        "success": True,
        "connected": True,
        "testnet": payload.testnet,
        "api_key_preview": mask_key(payload.api_key),
        "permissions": permissions,
        "can_trade": bool(account.get("canTrade")),
        "can_withdraw": can_withdraw,
    }


@router.get("/binance/connection", response_model=Dict[str, Any])
async def get_binance_connection(
    current_user: User = Depends(get_current_active_user),
):
    """Whether the caller has connected an account, and a masked key preview.

    Never returns the key or secret themselves — only enough to let the user
    recognise which key is stored.
    """
    if not current_user.encrypted_api_key:
        return {"success": True, "connected": False, "testnet": bool(current_user.binance_testnet)}

    api_key = decrypt_secret(current_user.encrypted_api_key)
    if api_key is None:
        # Stored under a previous encryption key — treat as disconnected so the
        # user is prompted to reconnect rather than shown a broken state.
        return {
            "success": True,
            "connected": False,
            "testnet": bool(current_user.binance_testnet),
            "note": "Stored credentials could not be read; please reconnect.",
        }

    return {
        "success": True,
        "connected": True,
        "testnet": bool(current_user.binance_testnet),
        "api_key_preview": mask_key(api_key),
        "last_sync_at": current_user.last_sync_at.isoformat() if current_user.last_sync_at else None,
        "last_sync_status": current_user.last_sync_status,
    }


@router.delete("/binance/connection", response_model=Dict[str, Any])
async def disconnect_binance(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Remove the caller's stored Binance credentials.

    Clears the stored keys only — imported trades and holdings are the user's
    own historical records and are left intact.
    """
    was_connected = bool(current_user.encrypted_api_key)

    current_user.encrypted_api_key = None
    current_user.encrypted_api_secret = None
    db.commit()

    log_audit_event(
        db, current_user.id, "binance_disconnect", "Binance account disconnected",
        entity_type="user", entity_id=current_user.id,
    )

    return {"success": True, "connected": False, "was_connected": was_connected}
