#!/usr/bin/env python3
"""
Password Reset API endpoints
Forgot password and reset password functionality
"""

from fastapi import APIRouter, Depends, Request as FastAPIRequest
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, validator
from datetime import timedelta

from core.dependencies import get_db
from core.auth import auth_manager
from core.config import settings
from core.errors import AuthenticationError, NotFoundError, DatabaseError
from database.models import User
from services.email_service import email_service
from core.audit import log_audit_event
from core.validators import validate_password_strength

router = APIRouter()


# Pydantic models
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        return validate_password_strength(v)


@router.post("/auth/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    http_request: FastAPIRequest,
    db: Session = Depends(get_db)
):
    """
    Request a password reset email
    """
    ip_address = http_request.client.host if http_request.client else "unknown"
    user_agent = http_request.headers.get("user-agent", "unknown")
    try:
        # Check if user exists
        user = db.query(User).filter(User.email == request.email).first()

        # Always return success even if user not found (security best practice)
        # This prevents email enumeration attacks
        if not user:
            return {
                "message": "If an account with this email exists, a password reset link has been sent.",
                "email": request.email
            }

        # Generate reset token (valid for 1 hour)
        reset_token = auth_manager.create_access_token(
            data={"sub": str(user.id), "type": "password_reset"},
            expires_delta=timedelta(hours=1)
        )

        # Send reset email
        reset_url = f"{settings.frontend_url}/reset-password"

        email_sent = email_service.send_password_reset_email(
            recipient_email=user.email,
            reset_token=reset_token,
            reset_url=reset_url
        )

        log_audit_event(db, user.id, "password_reset_requested",
                         f"Password reset requested for '{user.username}'",
                         entity_type="user", entity_id=user.id,
                         ip_address=ip_address, user_agent=user_agent,
                         success=email_sent, error_message=None if email_sent else "email_send_failed")

        if not email_sent:
            raise DatabaseError("Failed to send password reset email")

        return {
            "message": "If an account with this email exists, a password reset link has been sent.",
            "email": request.email
        }

    except Exception as e:
        # Don't expose internal errors for security
        print(f"Password reset error: {str(e)}")
        return {
            "message": "If an account with this email exists, a password reset link has been sent.",
            "email": request.email
        }


@router.post("/auth/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    http_request: FastAPIRequest,
    db: Session = Depends(get_db)
):
    """
    Reset password using the token from email
    """
    try:
        # Verify token
        payload = auth_manager.verify_token(request.token)

        # Check token type
        if payload.get("type") != "password_reset":
            raise AuthenticationError("Invalid reset token")

        user_id = int(payload.get("sub"))

        # Get user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise NotFoundError("User not found")

        # Hash new password
        new_hashed_password = auth_manager.get_password_hash(request.new_password)

        # Update password
        user.hashed_password = new_hashed_password
        from datetime import datetime
        user.updated_at = datetime.utcnow()
        db.commit()

        # Invalidate all user sessions (force re-login)
        auth_manager.invalidate_user_sessions(db, user.id)

        log_audit_event(db, user.id, "password_reset_completed",
                         f"Password reset completed for '{user.username}'",
                         entity_type="user", entity_id=user.id,
                         ip_address=http_request.client.host if http_request.client else "unknown",
                         user_agent=http_request.headers.get("user-agent", "unknown"))

        return {
            "message": "Password has been reset successfully. Please log in with your new password."
        }

    except AuthenticationError:
        raise
    except Exception as e:
        raise DatabaseError(f"Failed to reset password: {str(e)}")
