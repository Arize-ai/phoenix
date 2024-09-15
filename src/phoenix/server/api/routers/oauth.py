from authlib.integrations.starlette_client import OAuthError
from authlib.integrations.starlette_client import StarletteOAuth2App as OAuthClient
from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.responses import RedirectResponse
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_404_NOT_FOUND

from phoenix.server.rate_limiters import ServerRateLimiter, fastapi_rate_limiter

rate_limiter = ServerRateLimiter(
    per_second_rate_limit=0.2,
    enforcement_window_seconds=30,
    partition_seconds=60,
    active_partitions=2,
)
login_rate_limiter = fastapi_rate_limiter(rate_limiter, paths=["/login"])
router = APIRouter(
    prefix="/oauth", include_in_schema=False, dependencies=[Depends(login_rate_limiter)]
)


@router.post("/{idp}/login")
async def login(request: Request, idp: str) -> RedirectResponse:
    if not isinstance(oauth_client := request.app.state.oauth_clients.get_client(idp), OAuthClient):
        raise HTTPException(HTTP_404_NOT_FOUND, f"Unknown IDP: {idp}")
    redirect_uri = request.url_for("create_tokens", idp=idp)
    response: RedirectResponse = await oauth_client.authorize_redirect(request, redirect_uri)
    return response


@router.get("/{idp}/tokens")
async def create_tokens(request: Request, idp: str) -> RedirectResponse:
    if not isinstance(oauth_client := request.app.state.oauth_clients.get_client(idp), OAuthClient):
        raise HTTPException(HTTP_404_NOT_FOUND, f"Unknown IDP: {idp}")
    try:
        token = await oauth_client.authorize_access_token(request)
    except OAuthError as error:
        raise HTTPException(HTTP_401_UNAUTHORIZED, detail=str(error))
    print(f"{token=}")
    return RedirectResponse(url="/")
