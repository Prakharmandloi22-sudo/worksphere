from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from .config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_auth = HTTPBearer(auto_error=False)

async def verify_m2m_token(
    api_key: str = Security(api_key_header),
    credentials: HTTPAuthorizationCredentials = Security(bearer_auth)
):
    """
    Validates machine-to-machine authentication either through
    X-API-Key header or Bearer token matching the service shared secret.
    """
    token = None
    if api_key:
        token = api_key
    elif credentials and credentials.credentials:
        token = credentials.credentials

    if not token or token != settings.m2m_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized machine-to-machine request. Invalid or missing API key."
        )
    return True

