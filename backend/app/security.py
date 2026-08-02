"""
Password hashing, JWT issuance/validation, and token-generation helpers.

Kept in its own module (rather than inside `routers/auth.py`) so
`auth_dependencies.py` and any future router can import these primitives
without depending on the auth router itself -- same reasoning
`activity_log.py`/`project_helpers.py` already use for staying standalone.

Design, per the task brief:
- Passwords are hashed with bcrypt (via passlib's `CryptContext`), never
  stored or compared in plaintext. Bcrypt's own comparison is
  constant-time, which is what gives us "timing-safe password
  comparison" without hand-rolling one.
- Access tokens are short-lived, stateless JWTs (HS256) carrying `sub`
  (user id) and `sid` (Session row id) claims.
- Refresh tokens are opaque random strings, never JWTs -- only their
  SHA-256 hash is ever persisted (`Session.refresh_token_hash`), so a
  stolen database dump can't be replayed as a live refresh token. Each
  refresh rotates: the old token stops working and a new one is issued,
  bound to the same Session row.
"""
import hashlib
import os
import secrets
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext

# ======================================================================
# Configuration
#
# `AUTH_SECRET_KEY` should always be set via environment variable in any
# real deployment (see ENGINEERING_GUIDELINES.md "Security": "Never
# hardcode ... Secrets ... Use environment variables"). The fallback
# below only exists so this single-user local app boots out of the box;
# it is intentionally obvious/greppable so nobody mistakes it for a real
# secret.
# ======================================================================
SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "dev-insecure-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
PASSWORD_RESET_EXPIRE_MINUTES = 60
EMAIL_VERIFICATION_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ======================================================================
# Password hashing
# ======================================================================

def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Timing-safe by construction -- passlib's bcrypt backend always
    performs the full hash comparison regardless of where the strings
    first differ."""
    if not password_hash:
        return False
    try:
        return pwd_context.verify(plain_password, password_hash)
    except (ValueError, TypeError):
        # Malformed/unrecognized hash -- treat as "does not match"
        # rather than raising, so callers never need a second try/except.
        return False


class PasswordPolicyError(ValueError):
    """Raised by `validate_password_strength` -- kept as its own
    exception type (rather than a bare ValueError) so routers can catch
    it specifically and return a 422 with `.args[0]` as the detail."""


# Each rule is (predicate, message) so future password-policy expansion
# (task brief: "Support future password policy expansion") is "append a
# tuple," not "rewrite the function."
_PASSWORD_RULES = [
    (lambda p: len(p) >= 8, "Password must be at least 8 characters long"),
    (lambda p: len(p) <= 128, "Password must be at most 128 characters long"),
    (lambda p: any(c.isalpha() for c in p), "Password must contain at least one letter"),
    (lambda p: any(c.isdigit() for c in p), "Password must contain at least one number"),
]


def validate_password_strength(password: str) -> None:
    """Raises `PasswordPolicyError` on the first failing rule."""
    for predicate, message in _PASSWORD_RULES:
        if not predicate(password):
            raise PasswordPolicyError(message)


# ======================================================================
# JWT access tokens
# ======================================================================

def create_access_token(user_id: str, session_id: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "sid": session_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


class TokenError(Exception):
    """Raised by `decode_access_token` for any invalid/expired/malformed
    token -- callers translate this into a 401, never a 500."""


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise TokenError("Access token has expired")
    except jwt.InvalidTokenError:
        raise TokenError("Invalid access token")
    if payload.get("type") != "access":
        raise TokenError("Invalid token type")
    return payload


# ======================================================================
# Opaque refresh tokens / password-reset / email-verification tokens
# ======================================================================

def generate_opaque_token(num_bytes: int = 32) -> str:
    return secrets.token_urlsafe(num_bytes)


def hash_token(token: str) -> str:
    """SHA-256, not bcrypt -- these tokens are already high-entropy
    random strings (not human-chosen passwords), so a fast, deterministic
    hash is appropriate and lets us look them up with an indexed equality
    query instead of checking every row through bcrypt.verify."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_refresh_token() -> tuple[str, str, datetime]:
    """Returns (raw_token, token_hash, expires_at). The raw token is
    returned to the client exactly once and never persisted; only the
    hash is stored on the Session row."""
    raw = generate_opaque_token(48)
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return raw, hash_token(raw), expires_at
