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
    # Generic response regardless of whether the email exists, is already
    # verified, or the send fails - mirrors forgot_password's anti-enumeration
    # pattern. Previously this branch returned a distinct 404 for unknown
    # emails, letting an attacker probe which emails are registered.
    generic_response = {
        "message": "If an account with this email exists and isn't verified yet, a verification code has been sent."
    }
    try:
        user = db.query(User).filter(User.email == request.email).first()

        if not user or user.is_verified:
            return generic_response

        # Generate and store OTP
        otp = email_service.generate_otp()
        email_service.store_otp(request.email, otp)
        email_service.send_otp_email(request.email, otp)

        return generic_response

    except Exception:
        return generic_response


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
        # Check if user exists. A distinct "user not found" response here (vs.
        # the generic invalid-code message below) would let an attacker
        # enumerate registered emails by submitting a bogus code and reading
        # the response - so an unknown email falls through to the same
        # invalid-code path as a real user with a wrong OTP.
        user = db.query(User).filter(User.email == request.email).first()

        if user and user.is_verified:
            return {
                "message": "Email is already verified",
                "verified": True
            }

        # Verify OTP. Message text must match verify_otp's own "no OTP found"
        # wording exactly for the unknown-email case below - any difference
        # in wording (not just a shared 422 status) is still an enumeration
        # oracle an attacker can diff against.
        is_valid, message = email_service.verify_otp(request.email, request.otp) if user else (False, "No OTP found or it has expired")

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
