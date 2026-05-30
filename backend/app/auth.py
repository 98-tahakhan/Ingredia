"""
Supabase JWT authentication middleware.
Verifies the access token from the Authorization header.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from .config import SUPABASE_JWT_SECRET

security = HTTPBearer(auto_error=False)


def get_jwt_secret() -> str:
    """Get the JWT secret for token verification."""
    if SUPABASE_JWT_SECRET:
        return SUPABASE_JWT_SECRET
    # Fallback: Supabase uses the project's JWT secret
    # You can find this in Supabase Dashboard > Settings > API > JWT Secret
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="SUPABASE_JWT_SECRET not configured"
    )


def verify_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict:
    """
    Verify Supabase JWT token and return the payload.
    Returns user info dict with 'sub' (user_id), 'email', etc.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    secret = get_jwt_secret()

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no user ID"
            )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_id(payload: dict = Depends(verify_token)) -> str:
    """Extract the current user's ID from the verified JWT."""
    return payload["sub"]


def optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> str | None:
    """
    Optionally verify token. Returns user_id if valid token present, None otherwise.
    Use for endpoints that work for both authenticated and anonymous users.
    """
    if not credentials:
        return None

    try:
        secret = get_jwt_secret()
        payload = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload.get("sub")
    except (JWTError, HTTPException):
        return None
