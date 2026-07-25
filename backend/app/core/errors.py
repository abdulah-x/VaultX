#!/usr/bin/env python3
"""
Comprehensive error handling for the Crypto Portfolio API
"""

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from binance.exceptions import BinanceAPIException
from typing import Any, Dict, Optional
import logging
import traceback
from datetime import datetime

from core.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class APIError(Exception):
    """Base API error class"""
    def __init__(
        self, 
        message: str, 
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str = "INTERNAL_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)

class AuthenticationError(APIError):
    """Authentication related errors"""
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTH_ERROR",
            details=details
        )

class AuthorizationError(APIError):
    """Authorization related errors"""
    def __init__(self, message: str = "Access denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="AUTHORIZATION_ERROR",
            details=details
        )

class ValidationError(APIError):
    """Data validation errors"""
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
            details=details
        )

class NotFoundError(APIError):
    """Resource not found errors"""
    def __init__(self, message: str = "Resource not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            details=details
        )

class DatabaseError(APIError):
    """Database related errors"""
    def __init__(self, message: str = "Database error", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            details=details
        )

class ExternalAPIError(APIError):
    """External API related errors (e.g., Binance)"""
    def __init__(self, message: str = "External API error", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_502_BAD_GATEWAY,
            error_code="EXTERNAL_API_ERROR",
            details=details
        )

def create_error_response(
    error: APIError,
    request_id: Optional[str] = None,
    timestamp: Optional[datetime] = None
) -> Dict[str, Any]:
    """Create standardized error response"""
    return {
        "error": {
            "code": error.error_code,
            "message": error.message,
            "details": error.details,
            "status": error.status_code,
            "timestamp": (timestamp or datetime.utcnow()).isoformat(),
            "request_id": request_id
        }
    }

async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    """Handle custom API errors"""
    request_id = getattr(request.state, 'request_id', None)
    
    logger.error(
        f"API Error: {exc.error_code} - {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "details": exc.details
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(exc, request_id)
    )

async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle FastAPI validation errors"""
    request_id = getattr(request.state, 'request_id', None)
    
    error_details = {
        "validation_errors": []
    }
    
    for error in exc.errors():
        error_details["validation_errors"].append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    logger.warning(
        f"Validation Error: {len(exc.errors())} validation errors",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "errors": error_details["validation_errors"]
        }
    )
    
    api_error = ValidationError("Request validation failed", error_details)
    return JSONResponse(
        status_code=api_error.status_code,
        content=create_error_response(api_error, request_id)
    )

async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTP exceptions"""
    request_id = getattr(request.state, 'request_id', None)
    
    logger.warning(
        f"HTTP Exception: {exc.status_code} - {exc.detail}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "details": {},
                "status": exc.status_code,
                "timestamp": datetime.utcnow().isoformat(),
                "request_id": request_id
            }
        }
    )

async def database_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Handle database errors"""
    request_id = getattr(request.state, 'request_id', None)
    
    if isinstance(exc, IntegrityError):
        api_error = DatabaseError(
            "Data integrity constraint violation",
            {"database_error": "Duplicate or invalid data"}
        )
    else:
        # str(exc) on a SQLAlchemy error routinely includes the failing SQL
        # statement, bound parameters and table/column names -- never put it
        # in the client-facing response. The full text still goes to the log
        # line below, where an operator (not a caller) can see it.
        api_error = DatabaseError(
            "Database operation failed",
            {}
        )
    
    logger.error(
        f"Database Error: {type(exc).__name__} - {str(exc)}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=api_error.status_code,
        content=create_error_response(api_error, request_id)
    )

async def binance_error_handler(request: Request, exc: BinanceAPIException) -> JSONResponse:
    """Handle Binance API errors"""
    request_id = getattr(request.state, 'request_id', None)
    
    api_error = ExternalAPIError(
        f"Binance API error: {exc.message}",
        {
            "binance_code": exc.code,
            "binance_message": exc.message,
            "status_code": exc.status_code
        }
    )
    
    logger.error(
        f"Binance API Error: {exc.code} - {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "binance_code": exc.code
        }
    )
    
    return JSONResponse(
        status_code=api_error.status_code,
        content=create_error_response(api_error, request_id)
    )

async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions"""
    request_id = getattr(request.state, 'request_id', None)
    
    logger.error(
        f"Unexpected Error: {type(exc).__name__} - {str(exc)}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "traceback": traceback.format_exc()
        }
    )
    
    # logger.level is NOTSET (0) unless something calls .setLevel() -- which
    # nothing here does -- so `logger.level <= logging.DEBUG` was always True
    # regardless of environment, and the exception's class name leaked to
    # every caller in production. Gate on the actual debug setting instead.
    api_error = APIError(
        "An unexpected error occurred",
        details={"error_type": type(exc).__name__} if settings.debug else {}
    )
    
    return JSONResponse(
        status_code=api_error.status_code,
        content=create_error_response(api_error, request_id)
    )