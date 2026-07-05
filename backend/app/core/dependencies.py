#!/usr/bin/env python3
"""
Authentication dependencies for FastAPI endpoints
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from database.connection import SessionLocal
from database.models import User, UserSession
from core.auth import auth_manager
from core.config import settings
from core.errors import AuthenticationError, AuthorizationError
from core.redis_client import redis_client

# Security scheme
security = HTTPBearer(auto_error=False)

def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from JWT token
    """
    if not credentials:
        raise AuthenticationError("Authentication token required")
    
    try:
        # Check if token is blacklisted (logged out)
        if redis_client.is_token_blacklisted(credentials.credentials):
            raise AuthenticationError("Token has been invalidated")
        
        # Verify the JWT token
        payload = auth_manager.verify_token(credentials.credentials)

        # Reject special-purpose tokens (e.g. password reset) as API credentials.
        # These are issued for a single flow and must never authenticate requests.
        token_type = payload.get("type")
        if token_type and token_type != "access":
            raise AuthenticationError("This token cannot be used for authentication")

        user_id_str: str = payload.get("sub")

        if user_id_str is None:
            raise AuthenticationError("Invalid token payload")
        
        # Convert user_id from string to integer
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            raise AuthenticationError("Invalid user ID in token")
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise AuthenticationError("User not found")
        
        # Check if user is active
        if not user.is_active:
            raise AuthorizationError("User account is disabled")
        
        return user
        
    except Exception as e:
        if isinstance(e, (AuthenticationError, AuthorizationError)):
            raise e
        # Log the actual error for debugging
        print(f"JWT Verification Error: {type(e).__name__}: {e}")
        raise AuthenticationError(f"Invalid authentication token: {str(e)}")

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get the current active user (additional check for active status)
    """
    if not current_user.is_active:
        raise AuthorizationError("User account is disabled")
    return current_user

async def get_current_verified_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Get the current verified user (requires email verification)
    """
    if not current_user.is_verified:
        raise AuthorizationError("User account is not verified")
    return current_user

async def require_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Require the current user to be an administrator.

    Admins are defined by the ADMIN_EMAILS setting (comma-separated). The list is
    empty by default, so privileged routes (e.g. database backup/restore) are
    locked down until an operator explicitly opts specific accounts in.
    """
    admins = settings.admin_email_list
    if not current_user.email or current_user.email.lower() not in admins:
        raise AuthorizationError("Administrator privileges required")
    return current_user

async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get the current user if token is provided, otherwise return None
    Useful for endpoints that work for both authenticated and anonymous users
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except:
        return None

def require_user_access(resource_user_id: int):
    """
    Dependency factory to ensure user can only access their own resources
    """
    async def check_user_access(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.id != resource_user_id:
            raise AuthorizationError("Access denied: Cannot access other user's resources")
        return current_user
    
    return check_user_access

class RequestIDMiddleware:
    """
    Middleware to add unique request ID to each request
    """
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request_id = str(uuid.uuid4())
            scope["state"]["request_id"] = request_id
        
        await self.app(scope, receive, send)