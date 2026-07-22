#!/usr/bin/env python3
"""
Authentication API endpoints
User registration, login, logout, profile management
"""

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import re
import secrets

from core.config import settings
from core.dependencies import get_db, get_current_active_user, get_current_user
from core.auth import auth_manager
from core.errors import (
    AuthenticationError,
    ValidationError,
    NotFoundError,
    DatabaseError
)
from core.guest import (
    GUEST_CLAIM,
    GUEST_MAX_PER_IP,
    GUEST_TOKEN_MINUTES,
    GUEST_WINDOW_SECONDS,
)
from database.models import User, UserSession
from core.redis_client import redis_client
from core.audit import log_audit_event
from core.validators import validate_password_strength

router = APIRouter()

# Failed-login throttle. Counted per (IP, username) pair so neither a shared
# egress IP nor a targeted username can be used to lock out a third party.
MAX_LOGIN_ATTEMPTS = 10
LOGIN_ATTEMPT_WINDOW_SECONDS = 900  # 15 minutes

# Security scheme for token extraction
security = HTTPBearer()

async def get_current_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract the current JWT token"""
    return credentials.credentials

# Pydantic models for requests and responses
class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    timezone: Optional[str] = "UTC"
    preferred_currency: Optional[str] = "USD"
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Username must be between 3 and 50 characters')
        # Allow email format as username or alphanumeric with underscores
        if not re.match(r'^[a-zA-Z0-9._@]+$', v):
            raise ValueError('Username can only contain letters, numbers, underscores, dots, and @ symbol')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        return validate_password_strength(v)

class UserLogin(BaseModel):
    username: str  # Can be username or email
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]

class UserProfile(BaseModel):
    id: int
    username: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    timezone: str
    preferred_currency: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]

class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    timezone: Optional[str] = None
    preferred_currency: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    
    @validator('new_password')
    def validate_new_password(cls, v):
        return validate_password_strength(v)

@router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserRegistration,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Register a new user account
    """
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    try:
        # Check if username or email already exists
        existing_user = db.query(User).filter(
            (User.username == user_data.username) | (User.email == user_data.email)
        ).first()

        if existing_user:
            # A username collision is safe to state plainly — usernames are public
            # and the user has to be told to pick another. An *email* collision is
            # not: saying "email already registered" confirms an address has an
            # account here. Both cases therefore return the username wording, and
            # the real reason is recorded only in the audit log.
            reason = "username_taken" if existing_user.username == user_data.username else "email_taken"
            log_audit_event(db, None, "register", f"Registration failed: {reason}",
                             ip_address=client_ip, user_agent=user_agent, success=False, error_message=reason)
            raise ValidationError("Username or email is unavailable")

        # Create new user
        hashed_password = auth_manager.get_password_hash(user_data.password)

        new_user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            timezone=user_data.timezone,
            preferred_currency=user_data.preferred_currency,
            is_active=True,
            is_verified=False  # Require email verification
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Create access token
        token_data = {"sub": str(new_user.id), "username": new_user.username}
        access_token = auth_manager.create_access_token(token_data)

        # Create user session
        auth_manager.create_user_session(
            db, new_user.id, user_agent, client_ip
        )

        # Update last login
        new_user.last_login = datetime.utcnow()
        db.commit()

        log_audit_event(db, new_user.id, "register", f"User '{new_user.username}' registered",
                         entity_type="user", entity_id=new_user.id, ip_address=client_ip, user_agent=user_agent)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=auth_manager.access_token_expire_minutes * 60,
            user={
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
                "is_verified": new_user.is_verified
            }
        )

    except ValidationError:
        raise
    except Exception as e:
        raise DatabaseError(f"Failed to create user account: {str(e)}")

@router.post("/auth/guest", response_model=TokenResponse)
async def guest_login(request: Request, db: Session = Depends(get_db)):
    """Start a read-only demo session — no signup, no credentials.

    Every guest is issued a short-lived token pointing at the *same* seeded demo
    account (`backend/create_demo_account.py`), so there is nothing to create here
    and nothing to clean up afterwards: the portfolio, the analytics and the
    exported reports a guest sees are the ones that were generated once for that
    account, not regenerated per visitor.

    The token carries a `guest` claim which the middleware in `main.py` uses to
    refuse every unsafe HTTP method, keeping the shared account read-only.
    """
    if not settings.guest_mode_enabled:
        raise NotFoundError("Demo mode is not available")

    client_ip = request.client.host if request.client else "unknown"

    # This endpoint takes no credentials, so the IP is the only thing to throttle
    # on. Without it, anyone could mint tokens in a loop and drive traffic to the
    # market-data and export endpoints on our Binance rate limit.
    if redis_client.incr_rate_counter(f"guest:{client_ip}", GUEST_WINDOW_SECONDS) > GUEST_MAX_PER_IP:
        raise AuthenticationError(
            "Too many demo sessions from this address. Please try again later."
        )

    demo_user = db.query(User).filter(User.email == settings.demo_user_email).first()
    if not demo_user or not demo_user.is_active:
        # Misconfiguration (seeder never run), not a client error — but don't
        # advertise which of the two it is.
        raise NotFoundError("Demo mode is not available")

    access_token = auth_manager.create_access_token(
        {
            "sub": str(demo_user.id),
            "username": demo_user.username,
            GUEST_CLAIM: True,
            # Every guest token shares the same subject and claims, so without a
            # unique id two guests starting in the same second would receive
            # byte-identical JWTs — and one of them logging out would blacklist
            # the other's session. Regular logins don't hit this because their
            # subjects differ.
            "jti": secrets.token_urlsafe(16),
        },
        expires_delta=timedelta(minutes=GUEST_TOKEN_MINUTES),
    )

    # Deliberately no UserSession row and no audit entry: guests are anonymous
    # and share one user_id, so both would accumulate thousands of identical
    # rows that identify nobody.
    return TokenResponse(
        access_token=access_token,
        expires_in=GUEST_TOKEN_MINUTES * 60,
        user={
            "id": demo_user.id,
            "username": demo_user.username,
            "email": demo_user.email,
            "first_name": demo_user.first_name,
            "last_name": demo_user.last_name,
            "is_active": True,
            "is_verified": True,
            "is_guest": True,
        },
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login_user(
    login_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return access token
    """
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    rate_key = f"{client_ip}:{login_data.username}"
    try:
        # Throttle before doing any password work, so a locked-out attacker
        # can't keep consuming bcrypt CPU.
        if redis_client.get_failed_login_count(rate_key) >= MAX_LOGIN_ATTEMPTS:
            log_audit_event(db, None, "login", f"Login blocked for '{login_data.username}': too many attempts",
                             ip_address=client_ip, user_agent=user_agent, success=False, error_message="rate_limited")
            raise AuthenticationError(
                "Too many failed login attempts. Please try again later."
            )

        # Authenticate user
        user = auth_manager.authenticate_user(db, login_data.username, login_data.password)

        if not user:
            redis_client.register_failed_login(rate_key, LOGIN_ATTEMPT_WINDOW_SECONDS)
            log_audit_event(db, None, "login", f"Login failed for '{login_data.username}': invalid credentials",
                             ip_address=client_ip, user_agent=user_agent, success=False, error_message="invalid_credentials")
            raise AuthenticationError("Invalid username/email or password")

        if not user.is_active:
            log_audit_event(db, user.id, "login", f"Login failed for '{user.username}': account disabled",
                             ip_address=client_ip, user_agent=user_agent, success=False, error_message="account_disabled")
            raise AuthenticationError("Account is disabled")

        # Successful auth clears the throttle for this IP/username pair.
        redis_client.clear_failed_logins(rate_key)

        # Create access token
        token_data = {"sub": str(user.id), "username": user.username}
        access_token = auth_manager.create_access_token(token_data)

        # Create user session
        auth_manager.create_user_session(
            db, user.id, user_agent, client_ip
        )

        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()

        log_audit_event(db, user.id, "login", f"User '{user.username}' logged in",
                         entity_type="user", entity_id=user.id, ip_address=client_ip, user_agent=user_agent)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=auth_manager.access_token_expire_minutes * 60,
            user={
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_verified": user.is_verified
            }
        )

    except AuthenticationError:
        raise
    except Exception as e:
        raise DatabaseError(f"Login failed: {str(e)}")

@router.get("/auth/logout")
async def logout_user_get(
    request: Request,
    current_user: User = Depends(get_current_user),
    current_token: str = Depends(get_current_token),
    db: Session = Depends(get_db)
):
    """
    Logout current user (GET method for compatibility).
    Blacklists the presented token for its remaining lifetime, same as POST.
    """
    try:
        payload = auth_manager.verify_token(current_token)
        remaining_seconds = max(0, int(payload.get("exp", 0) - datetime.utcnow().timestamp()))
        token_invalidated = True
        if remaining_seconds > 0:
            token_invalidated = bool(redis_client.blacklist_token(current_token, remaining_seconds))

        log_audit_event(db, current_user.id, "logout", f"User '{current_user.username}' logged out (GET)",
                         entity_type="user", entity_id=current_user.id,
                         ip_address=request.client.host if request.client else "unknown",
                         user_agent=request.headers.get("user-agent", "unknown"))

        return {
            "message": "Successfully logged out",
            "method": "GET",
            "token_invalidated": token_invalidated,
        }

    except Exception as e:
        raise DatabaseError(f"Logout failed: {str(e)}")

@router.post("/auth/logout")
async def logout_user(
    request: Request,
    current_user: User = Depends(get_current_user),
    current_token: str = Depends(get_current_token),
    db: Session = Depends(get_db)
):
    """
    Logout current user (invalidate current session)
    """
    try:
        # Get token expiration time to set blacklist expiration
        payload = auth_manager.verify_token(current_token)
        exp_timestamp = payload.get("exp", 0)
        current_timestamp = datetime.utcnow().timestamp()

        # Calculate remaining time until token expires
        remaining_seconds = max(0, int(exp_timestamp - current_timestamp))

        log_audit_event(db, current_user.id, "logout", f"User '{current_user.username}' logged out (POST)",
                         entity_type="user", entity_id=current_user.id,
                         ip_address=request.client.host if request.client else "unknown",
                         user_agent=request.headers.get("user-agent", "unknown"))

        # Blacklist the token for its remaining lifetime
        if remaining_seconds > 0:
            success = redis_client.blacklist_token(current_token, remaining_seconds)
            if success:
                return {
                    "message": "Successfully logged out",
                    "method": "POST",
                    "token_invalidated": True
                }
            else:
                return {
                    "message": "Logged out (token blacklisting unavailable)",
                    "method": "POST",
                    "token_invalidated": False
                }
        else:
            return {
                "message": "Successfully logged out (token already expired)",
                "method": "POST",
                "token_invalidated": True
            }

    except Exception as e:
        raise DatabaseError(f"Logout failed: {str(e)}")

@router.post("/auth/logout-all")
async def logout_all_devices(
    request: Request,
    current_user: User = Depends(get_current_user),
    current_token: str = Depends(get_current_token),
    db: Session = Depends(get_db)
):
    """
    Logout from all devices (invalidate all user sessions)
    """
    try:
        # Invalidate database sessions
        auth_manager.invalidate_user_sessions(db, current_user.id)

        # Also blacklist current token
        payload = auth_manager.verify_token(current_token)
        exp_timestamp = payload.get("exp", 0)
        current_timestamp = datetime.utcnow().timestamp()
        remaining_seconds = max(0, int(exp_timestamp - current_timestamp))

        if remaining_seconds > 0:
            redis_client.blacklist_token(current_token, remaining_seconds)

        log_audit_event(db, current_user.id, "logout_all", f"User '{current_user.username}' logged out from all devices",
                         entity_type="user", entity_id=current_user.id,
                         ip_address=request.client.host if request.client else "unknown",
                         user_agent=request.headers.get("user-agent", "unknown"))

        return {
            "message": "Successfully logged out from all devices",
            "current_token_invalidated": True
        }
        
    except Exception as e:
        raise DatabaseError(f"Logout all failed: {str(e)}")

@router.get("/auth/profile", response_model=UserProfile)
async def get_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's profile information
    """
    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        timezone=current_user.timezone,
        preferred_currency=current_user.preferred_currency,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        last_login=current_user.last_login
    )

@router.put("/auth/profile", response_model=UserProfile)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile information
    """
    try:
        # Update only provided fields
        if profile_data.first_name is not None:
            current_user.first_name = profile_data.first_name
        if profile_data.last_name is not None:
            current_user.last_name = profile_data.last_name
        if profile_data.timezone is not None:
            current_user.timezone = profile_data.timezone
        if profile_data.preferred_currency is not None:
            current_user.preferred_currency = profile_data.preferred_currency
        
        current_user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_user)
        
        return UserProfile(
            id=current_user.id,
            username=current_user.username,
            email=current_user.email,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            timezone=current_user.timezone,
            preferred_currency=current_user.preferred_currency,
            is_active=current_user.is_active,
            is_verified=current_user.is_verified,
            created_at=current_user.created_at,
            last_login=current_user.last_login
        )
        
    except Exception as e:
        raise DatabaseError(f"Failed to update profile: {str(e)}")

@router.post("/auth/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change user's password
    """
    try:
        # Verify current password
        if not auth_manager.verify_password(password_data.current_password, current_user.hashed_password):
            raise AuthenticationError("Current password is incorrect")
        
        # Hash new password
        new_hashed_password = auth_manager.get_password_hash(password_data.new_password)
        
        # Update password
        current_user.hashed_password = new_hashed_password
        current_user.updated_at = datetime.utcnow()
        db.commit()
        
        # Invalidate all sessions (force re-login on all devices)
        auth_manager.invalidate_user_sessions(db, current_user.id)
        
        return {"message": "Password changed successfully. Please log in again on all devices."}
        
    except AuthenticationError:
        raise
    except Exception as e:
        raise DatabaseError(f"Failed to change password: {str(e)}")

@router.get("/auth/verify-token")
async def verify_token(
    current_user: User = Depends(get_current_user)
):
    """
    Verify if the current token is valid
    """
    return {
        "valid": True,
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "is_active": current_user.is_active
        }
    }