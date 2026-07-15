#!/usr/bin/env python3
"""
Shared Pydantic field validators, reused across auth/registration/password-reset
request models so the password policy can't drift between endpoints again.
"""
import re


def validate_password_strength(v: str) -> str:
    """Minimum password policy: 8+ chars, at least one upper/lower/digit."""
    if len(v) < 8:
        raise ValueError('Password must be at least 8 characters long')
    if not re.search(r'[A-Z]', v):
        raise ValueError('Password must contain at least one uppercase letter')
    if not re.search(r'[a-z]', v):
        raise ValueError('Password must contain at least one lowercase letter')
    if not re.search(r'\d', v):
        raise ValueError('Password must contain at least one digit')
    return v
