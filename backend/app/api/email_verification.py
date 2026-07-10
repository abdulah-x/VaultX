#!/usr/bin/env python3
"""
Email Verification API endpoints
Send and verify OTP codes for email verification
"""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime

from core.dependencies import get_db, get_current_user
from core.errors import ValidationError, NotFoundError
from database.models import User
from services.email_service import email_service
from core.audit import log_audit_event

router = APIRouter()


# Pydantic models
class SendVerificationRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str


@router.post("/auth/send-verification")
async def send_verification_email(
    request: SendVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Send verification OTP to user's email
    """
    try:
        # Check if user exists
        user = db.query(User).filter(User.email == request.email).first()
        
        if not user:
            raise NotFoundError("User not found")
        
        if user.is_verified:
            return {
                "message": "Email is already verified",
                "already_verified": True
            }
        
        # Generate and store OTP
        otp = email_service.generate_otp()
        email_service.store_otp(request.email, otp)
        
        # Send OTP email
        email_sent = email_service.send_otp_email(request.email, otp)
        
        if not email_sent:
            raise ValidationError("Failed to send verification email")
        
        return {
            "message": "Verification code sent to your email",
            "email": request.email
        }
        
    except (ValidationError, NotFoundError):
        raise
    except Exception as e:
        raise ValidationError(f"Failed to send verification email: {str(e)}")


@router.post("/auth/verify-email")
async def verify_email(
    request: VerifyEmailRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Verify email with OTP code
    """
    try:
        # Check if user exists
        user = db.query(User).filter(User.email == request.email).first()

        if not user:
            raise NotFoundError("User not found")

        if user.is_verified:
            return {
                "message": "Email is already verified",
                "verified": True
            }

        # Verify OTP
        is_valid, message = email_service.verify_otp(request.email, request.otp)

        if not is_valid:
            raise ValidationError(message)

        # Mark user as verified
        user.is_verified = True
        user.updated_at = datetime.utcnow()
        db.commit()

        log_audit_event(db, user.id, "email_verified", f"Email verified for '{user.username}'",
                         entity_type="user", entity_id=user.id,
                         ip_address=http_request.client.host if http_request.client else "unknown",
                         user_agent=http_request.headers.get("user-agent", "unknown"))

        return {
            "message": "Email verified successfully",
            "verified": True
        }

    except (ValidationError, NotFoundError):
        raise
    except Exception as e:
        raise ValidationError(f"Failed to verify email: {str(e)}")


@router.post("/auth/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resend verification OTP to current user's email
    """
    try:
        if current_user.is_verified:
            return {
                "message": "Email is already verified",
                "already_verified": True
            }
        
        # Generate and store OTP
        otp = email_service.generate_otp()
        email_service.store_otp(current_user.email, otp)
        
        # Send OTP email
        email_sent = email_service.send_otp_email(current_user.email, otp)
        
        if not email_sent:
            raise ValidationError("Failed to send verification email")
        
        return {
            "message": "Verification code sent to your email",
            "email": current_user.email
        }
        
    except ValidationError:
        raise
    except Exception as e:
        raise ValidationError(f"Failed to send verification email: {str(e)}")
