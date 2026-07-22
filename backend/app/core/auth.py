#!/usr/bin/env python3
"""
Authentication utilities for JWT token management
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
import logging
import secrets

from core.config import settings
from database.models import User, UserSession

logger = logging.getLogger(__name__)

# Password hashing context - simplified for compatibility
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hashed once at import so a failed lookup in authenticate_user costs the same
# bcrypt work as a real password check. The plaintext is irrelevant — nothing
# ever verifies against it successfully.
_DUMMY_PASSWORD_HASH = pwd_context.hash("vaultx-constant-time-placeholder")

class AuthManager:
    """Handles all authentication operations"""
    
    def __init__(self):
        self.secret_key = settings.secret_key
        self.algorithm = settings.algorithm
        self.access_token_expire_minutes = settings.access_token_expire_minutes
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        try:
            # Ensure password is string and handle encoding properly
            if not isinstance(plain_password, str):
                plain_password = str(plain_password)
            
            # Truncate to 72 bytes if necessary (bcrypt limitation)
            password_bytes = plain_password.encode('utf-8')
            if len(password_bytes) > 72:
                plain_password = password_bytes[:72].decode('utf-8', errors='ignore')
            
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            logger.exception("Password verification failed")
            return False
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password"""
        try:
            # Ensure password is string and handle encoding properly
            if not isinstance(password, str):
                password = str(password)
            
            # Truncate to 72 bytes if necessary (bcrypt limitation)
            password_bytes = password.encode('utf-8')
            if len(password_bytes) > 72:
                password = password_bytes[:72].decode('utf-8', errors='ignore')
            
            return pwd_context.hash(password)
        except Exception:
            logger.exception("Password hashing failed")
            raise
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError as e:
            # Log the reason, but never return it: the jose message distinguishes
            # "signature verification failed" from "expired" from "malformed",
            # which tells an attacker which part of a forged token to fix.
            logger.warning("JWT decode failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    def authenticate_user(self, db: Session, username: str, password: str) -> Optional[User]:
        """Authenticate a user with username/email and password.

        When no user matches we still run a bcrypt verify against a throwaway
        hash. Returning early would make "no such user" measurably faster than
        "wrong password", which turns response time into a username/email
        oracle — the same enumeration leak we close in the response bodies.
        """
        user = db.query(User).filter(
            (User.username == username) | (User.email == username)
        ).first()

        if not user:
            self.verify_password(password, _DUMMY_PASSWORD_HASH)
            return None

        if not self.verify_password(password, user.hashed_password):
            return None

        return user
    
    def create_user_session(self, db: Session, user_id: int, device_info: str = None, ip_address: str = None) -> UserSession:
        """Create a new user session record"""
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        session = UserSession(
            user_id=user_id,
            session_token=session_token,
            device_info=device_info,
            ip_address=ip_address,
            expires_at=expires_at
        )
        
        db.add(session)
        db.commit()
        db.refresh(session)
        
        return session
    
    def invalidate_user_sessions(self, db: Session, user_id: int) -> None:
        """Invalidate all user sessions (for logout all devices)"""
        db.query(UserSession).filter(UserSession.user_id == user_id).delete()
        db.commit()
    
    def cleanup_expired_sessions(self, db: Session) -> int:
        """Clean up expired sessions from database"""
        expired_count = db.query(UserSession).filter(
            UserSession.expires_at < datetime.utcnow()
        ).delete()
        db.commit()
        return expired_count

# Global auth manager instance
auth_manager = AuthManager()