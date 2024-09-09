import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import partial

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import and_, select
from sqlalchemy.orm import joinedload
from starlette.status import (
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_404_NOT_FOUND,
)

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
    Token,
    delete_access_token_cookie,
    delete_refresh_token_cookie,
    is_valid_password,
    set_access_token_cookie,
    set_refresh_token_cookie,
)
from phoenix.db.enums import UserRole
from phoenix.db.models import User as OrmUser
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.jwt_store import JwtStore
from phoenix.server.rate_limiters import ServerRateLimiter, fastapi_rate_limiter
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    RefreshTokenAttributes,
    RefreshTokenClaims,
    TokenStore,
    UserId,
)

rate_limiter = ServerRateLimiter(
    per_second_rate_limit=0.2,
    enforcement_window_seconds=30,
    partition_seconds=60,
    active_partitions=2,
)
login_rate_limiter = fastapi_rate_limiter(rate_limiter, paths=["/login"])
router = APIRouter(
    prefix="/auth", include_in_schema=False, dependencies=[Depends(login_rate_limiter)]
)


@router.post("/login")
async def login(request: Request) -> Response:
    assert isinstance(access_token_expiry := request.app.state.access_token_expiry, timedelta)
    assert isinstance(refresh_token_expiry := request.app.state.refresh_token_expiry, timedelta)
    data = await request.json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Email and password required")

    async with request.app.state.db() as session:
        user = await session.scalar(
            select(OrmUser)
            .where(and_(OrmUser.email == email, OrmUser.deleted_at.is_(None)))
            .options(joinedload(OrmUser.role))
        )
        if (
            user is None
            or (password_hash := user.password_hash) is None
            or (salt := user.password_salt) is None
        ):
            raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail=LOGIN_FAILED_MESSAGE)

    loop = asyncio.get_running_loop()
    password_is_valid = partial(
        is_valid_password, password=password, salt=salt, password_hash=password_hash
    )
    if not await loop.run_in_executor(None, password_is_valid):
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail=LOGIN_FAILED_MESSAGE)

    issued_at = datetime.now(timezone.utc)
    refresh_token_claims = RefreshTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + refresh_token_expiry,
        attributes=RefreshTokenAttributes(
            user_role=UserRole(user.role.name),
        ),
    )
    token_store: JwtStore = request.app.state.get_token_store()
    refresh_token, refresh_token_id = await token_store.create_refresh_token(refresh_token_claims)
    access_token_claims = AccessTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + access_token_expiry,
        attributes=AccessTokenAttributes(
            user_role=UserRole(user.role.name),
            refresh_token_id=refresh_token_id,
        ),
    )
    access_token, _ = await token_store.create_access_token(access_token_claims)
    response = Response(status_code=HTTP_204_NO_CONTENT)
    response = set_access_token_cookie(
        response=response, access_token=access_token, max_age=access_token_expiry
    )
    response = set_refresh_token_cookie(
        response=response, refresh_token=refresh_token, max_age=refresh_token_expiry
    )
    return response


@router.post("/logout")
async def logout(
    request: Request,
) -> Response:
    token_store: TokenStore = request.app.state.get_token_store()
    assert isinstance(user := request.user, PhoenixUser)
    await token_store.log_out(user.identity)
    response = Response(status_code=HTTP_204_NO_CONTENT)
    response = delete_access_token_cookie(response)
    response = delete_refresh_token_cookie(response)
    return response


@router.post("/refresh")
async def refresh_tokens(request: Request) -> Response:
    assert isinstance(access_token_expiry := request.app.state.access_token_expiry, timedelta)
    assert isinstance(refresh_token_expiry := request.app.state.refresh_token_expiry, timedelta)
    if (refresh_token := request.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME)) is None:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    token_store: JwtStore = request.app.state.get_token_store()
    refresh_token_claims = await token_store.read(Token(refresh_token))
    if (
        not isinstance(refresh_token_claims, RefreshTokenClaims)
        or (refresh_token_id := refresh_token_claims.token_id) is None
        or refresh_token_claims.subject is None
        or (user_id := int(refresh_token_claims.subject)) is None
        or (expiration_time := refresh_token_claims.expiration_time) is None
    ):
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if expiration_time.timestamp() < datetime.now().timestamp():
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Expired refresh token")
    await token_store.revoke(refresh_token_id)

    if (
        (access_token := request.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME)) is not None
        and isinstance(
            access_token_claims := await token_store.read(Token(access_token)), AccessTokenClaims
        )
        and (access_token_id := access_token_claims.token_id)
    ):
        await token_store.revoke(access_token_id)

    async with request.app.state.db() as session:
        if (
            user := await session.scalar(
                select(OrmUser)
                .where(and_(OrmUser.id == user_id, OrmUser.deleted_at.is_(None)))
                .options(joinedload(OrmUser.role))
            )
        ) is None:
            raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="User not found")
    user_role = UserRole(user.role.name)
    issued_at = datetime.now(timezone.utc)
    refresh_token_claims = RefreshTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + refresh_token_expiry,
        attributes=RefreshTokenAttributes(
            user_role=user_role,
        ),
    )
    refresh_token, refresh_token_id = await token_store.create_refresh_token(refresh_token_claims)
    access_token_claims = AccessTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + access_token_expiry,
        attributes=AccessTokenAttributes(
            user_role=user_role,
            refresh_token_id=refresh_token_id,
        ),
    )
    access_token, _ = await token_store.create_access_token(access_token_claims)
    response = Response(status_code=HTTP_204_NO_CONTENT)
    response = set_access_token_cookie(
        response=response, access_token=access_token, max_age=access_token_expiry
    )
    response = set_refresh_token_cookie(
        response=response, refresh_token=refresh_token, max_age=refresh_token_expiry
    )
    return response


@dataclass
class CreateOAuthTokensRequestBody:
    authorization_code: str
    redirect_uri: str


@router.post("/oauth-tokens")
async def create_oauth_tokens(
    request: Request,
    body: CreateOAuthTokensRequestBody,
) -> Response:
    if not isinstance(oauth_client_id := request.app.state.oauth_client_id, str) or not isinstance(
        oauth_client_secret := request.app.state.oauth_client_secret, str
    ):
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=(
                "An OAuth client ID and client secret must be passed via the "
                "`PHOENIX_OAUTH_CLIENT_ID` and `PHOENIX_OAUTH_CLIENT_SECRET` environment variables."
            ),
        )
    resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        json={
            "client_id": oauth_client_id,
            "client_secret": oauth_client_secret,
            "code": body.authorization_code,
            "redirect_uri": body.redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    resp.raise_for_status()
    response_data = resp.json()
    if not {"access_token", "expires_in", "scope", "token_type", "id_token"}.issubset(
        set(response_data.keys())
    ):
        return Response(status_code=HTTP_401_UNAUTHORIZED)
    # todo: generate phoenix access and refresh tokens and set as cookies
    response = Response(status_code=HTTP_204_NO_CONTENT)
    print("Login success")
    return response


LOGIN_FAILED_MESSAGE = "Invalid email and/or password"
