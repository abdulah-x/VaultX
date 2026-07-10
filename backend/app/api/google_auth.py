"""
Google OAuth Authentication Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime
import os
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests


from core.dependencies import get_db
from database.models import User
from core.auth import auth_manager
from core.config import settings
from core.audit import log_audit_event
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/auth", tags=["Google OAuth"])

# Environment variables
GOOGLE_CLIENT_ID = settings.google_client_id


# Pydantic models
class GoogleLoginRequest(BaseModel):
    token: str
    context: str = "signup"  # "signup" or "login"

class GoogleAuthResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

@router.post("/google/login", response_model=GoogleAuthResponse)
async def google_login(
    request: GoogleLoginRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Login or Signup with Google
    Accepts an access token or ID token from the frontend
    """
    try:
        # Verify ID token
        # Using GoogleLogin component returns an ID Token (in credential field)
        try:
            token = request.token
            id_info = id_token.verify_oauth2_token(
                token, 
                google_requests.Request(), 
                GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=60
            )
        except ValueError as e:
             print(f"Token Verification Error: {str(e)}")
             raise HTTPException(status_code=400, detail=f"Invalid Google token: {str(e)}")

        email = id_info.get("email")
        email_verified = id_info.get("email_verified")
        google_id = id_info.get("sub")
        picture = id_info.get("picture")
        given_name = id_info.get("given_name", "")
        family_name = id_info.get("family_name", "")
        
        if not email_verified:
            raise HTTPException(status_code=400, detail="Google email not verified")

        # Check if user exists
        existing_user = db.query(User).filter(User.email == email).first()
        
        if existing_user:
            # Login
            if not existing_user.is_active:
                raise HTTPException(status_code=403, detail="Account is disabled")
            
            # Update info if needed
            existing_user.last_login = datetime.utcnow()
            if not existing_user.oauth_id:
                existing_user.oauth_id = google_id
                existing_user.oauth_provider = "google"
                
            db.commit()

            # Generate token
            access_token = auth_manager.create_access_token({"sub": str(existing_user.id)})

            log_audit_event(db, existing_user.id, "login", f"User '{existing_user.username}' logged in via Google",
                             entity_type="user", entity_id=existing_user.id,
                             ip_address=http_request.client.host if http_request.client else "unknown",
                             user_agent=http_request.headers.get("user-agent", "unknown"))

            return GoogleAuthResponse(
                success=True,
                message="Login successful",
                data={
                    "access_token": access_token,
                    "token_type": "bearer",
                    "user": {
                        "id": existing_user.id,
                        "email": existing_user.email,
                        "username": existing_user.username,
                        "first_name": existing_user.first_name,
                        "last_name": existing_user.last_name,
                        "is_verified": True,
                        "created_at": existing_user.created_at.isoformat() if existing_user.created_at else None
                    }
                }
            )
        else:
            # Signup
            # Create unique username
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}{counter}"
                counter += 1
            
            new_user = User(
                email=email,
                username=username,
                first_name=given_name,
                last_name=family_name,
                hashed_password=auth_manager.get_password_hash(os.urandom(32).hex()),
                is_active=True,
                is_verified=True,
                oauth_provider="google",
                oauth_id=google_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(new_user)
            db.commit()
            db.refresh(new_user)

            access_token = auth_manager.create_access_token({"sub": str(new_user.id)})

            log_audit_event(db, new_user.id, "register", f"User '{new_user.username}' registered via Google",
                             entity_type="user", entity_id=new_user.id,
                             ip_address=http_request.client.host if http_request.client else "unknown",
                             user_agent=http_request.headers.get("user-agent", "unknown"))

            return GoogleAuthResponse(
                success=True,
                message="Account created successfully",
                data={
                    "access_token": access_token,
                    "token_type": "bearer",
                    "user": {
                        "id": new_user.id,
                        "email": new_user.email,
                        "username": new_user.username,
                        "first_name": new_user.first_name,
                        "last_name": new_user.last_name,
                        "is_verified": True,
                        "created_at": new_user.created_at.isoformat()
                    }
                }
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Google login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal authentication error")
