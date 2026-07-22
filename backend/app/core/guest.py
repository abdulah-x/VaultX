#!/usr/bin/env python3
"""
Guest ("try it out") mode.

A guest is not a new account. Every guest is handed a short-lived JWT that
points at one shared, read-only demo user — so there is no per-visitor row to
create, no cleanup job, and no duplicated 90 days of price history. The demo
account is seeded once (`backend/create_demo_account.py`) and every guest sees the
exact same portfolio, the same analytics, and the same exported reports.

That sharing is precisely why write protection has to be structural. If a single
mutating endpoint were reachable by a guest, any visitor could corrupt the demo
for everyone at once. Guarding routes one by one would work until someone adds
route N+1 and forgets, so instead the rule is inverted:

    a guest token may only perform safe (read-only) HTTP methods.

That is enforced in middleware (`main.py`) for every route that exists or will
ever exist, with a small, explicit allowlist for the few writes a guest legitimately
needs. `require_not_guest` below is the belt-and-braces dependency for routes that
want to say it outright, and `GUEST_DENIED_PREFIXES` covers surfaces that must be
blocked regardless of method.
"""
import logging
from typing import Optional

from jose import JWTError, jwt

from core.config import settings

logger = logging.getLogger(__name__)

# JWT claim marking a token as a guest session.
GUEST_CLAIM = "guest"

# Guest tokens are short-lived and cannot be refreshed. An abandoned browser tab
# stops being a valid credential within the hour.
GUEST_TOKEN_MINUTES = 60

# Guest session creation is unauthenticated, so it is throttled per IP.
GUEST_MAX_PER_IP = 10
GUEST_WINDOW_SECONDS = 3600

# Methods a guest may use. Everything else is refused by default.
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

# Writes a guest is explicitly permitted to make, as (method, exact path) pairs.
# Kept as short as it can possibly be: anything listed here is something an
# anonymous visitor can execute against the account every other guest is
# simultaneously looking at.
#
# Logout is the sole entry — it only blacklists the caller's own token, which
# touches no shared state, and without it "exit demo" would 403.
GUEST_ALLOWED_WRITES = frozenset({
    ("POST", "/api/auth/logout"),
})

# Surfaces closed to guests regardless of HTTP method. The advisor is gated
# because it spends real Gemini quota on every call and is a premium feature;
# a prefix (rather than an exact path) means a future GET/stream variant of it
# is covered without anyone having to remember to update this list.
GUEST_DENIED_PREFIXES = ("/api/advisor",)

GUEST_DENIED_MESSAGE = (
    "The AI advisor is not available in demo mode. Sign up for a free account to use it."
)
GUEST_READONLY_MESSAGE = (
    "You're exploring VaultX in demo mode, which is read-only. Sign up for a free "
    "account to connect your own portfolio."
)


def bearer_token(request) -> Optional[str]:
    """Pull the raw JWT out of an Authorization header, or None."""
    header = request.headers.get("authorization") or ""
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def token_is_guest(token: str) -> bool:
    """True if the token carries the guest claim.

    Deliberately non-raising: this runs in middleware, where an HTTPException
    would bypass the app's exception handlers. An invalid or expired token is
    simply "not a guest" here and gets rejected properly further down the stack
    by `get_current_user`, which does the real verification.
    """
    if not token:
        return False
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return False
    return bool(payload.get(GUEST_CLAIM))


def request_is_guest(request) -> bool:
    """True if this request is authenticated as a guest session."""
    return token_is_guest(bearer_token(request))


def is_guest_user(user) -> bool:
    """True if the resolved user came from a guest token.

    The flag is stamped onto the User instance by `get_current_user` from the
    token claim, not read from the database — the demo row itself is an ordinary
    user, and it's the *token* that is restricted, not the account.
    """
    return bool(getattr(user, "is_guest", False))
