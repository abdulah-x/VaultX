"""
Shared helper for writing to the audit_logs table.

One place to construct an AuditLog row so call sites across auth, password
reset, email verification, OAuth, trade import, portfolio sync, and backup
routes stay a single line each instead of duplicating the construction.
"""
import logging
from typing import Optional

from sqlalchemy.orm import Session

from database.models import AuditLog

logger = logging.getLogger(__name__)


def log_audit_event(
    db: Session,
    user_id: Optional[int],
    action_type: str,
    description: str,
    *,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    success: bool = True,
    error_message: Optional[str] = None,
) -> None:
    """Write one audit log row. Never raises - a logging failure must not
    break the request it's observing."""
    try:
        entry = AuditLog(
            user_id=user_id,
            action_type=action_type,
            action_description=description,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=error_message,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to write audit log ({action_type}): {e}")
