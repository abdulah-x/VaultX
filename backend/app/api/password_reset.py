#!/usr/bin/env python3
"""
Password Reset API endpoints
Forgot password and reset password functionality
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, validator
from datetime import timedelta
import re

from core.dependencies import get_db
from core.auth import auth_manager
from core.config import settings
from core.errors import AuthenticationError, NotFoundError, DatabaseError
from database.models import User
from services.email_service import email_service

router = APIRouter()


# Pydantic models
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        return v


@router.post("/auth/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Request a password reset email
    """
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
        
        return {
            "message": "Password has been reset successfully. Please log in with your new password."
        }
        
    except AuthenticationError:
        raise
    except Exception as e:
        raise DatabaseError(f"Failed to reset password: {str(e)}")
