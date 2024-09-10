import asyncio
from datetime import datetime, timezone
from functools import partial

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from starlette.status import HTTP_204_NO_CONTENT, HTTP_401_UNAUTHORIZED, HTTP_404_NOT_FOUND

from phoenix.auth import (
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
    PHOENIX_TOKEN_MAX_AGE,
    Token,
    delete_access_token_cookie,
    delete_refresh_token_cookie,
    is_valid_password,
    set_access_token_cookie,
    set_refresh_token_cookie,
)
from phoenix.db.enums import UserRole
from phoenix.db.models import User as OrmUser
from phoenix.server.bearer_auth import PhoenixUser, is_authenticated
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
    data = await request.json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Email and password required")

    async with request.app.state.db() as session:
        user = await session.scalar(
            select(OrmUser).where(OrmUser.email == email).options(joinedload(OrmUser.role))
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
        expiration_time=issued_at + PHOENIX_TOKEN_MAX_AGE,
        attributes=RefreshTokenAttributes(
            user_role=UserRole(user.role.name),
        ),
    )
    token_store: JwtStore = request.app.state.get_token_store()
    refresh_token, refresh_token_id = await token_store.create_refresh_token(refresh_token_claims)
    access_token_claims = AccessTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + PHOENIX_TOKEN_MAX_AGE,
        attributes=AccessTokenAttributes(
            user_role=UserRole(user.role.name),
            refresh_token_id=refresh_token_id,
        ),
    )
    access_token, _ = await token_store.create_access_token(access_token_claims)
    response = Response(status_code=HTTP_204_NO_CONTENT)
    response = set_access_token_cookie(response, access_token)
    response = set_refresh_token_cookie(response, refresh_token)
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


@router.post("/refresh", dependencies=[Depends(is_authenticated)])
async def refresh_tokens(request: Request) -> Response:
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

    async with request.app.state.db() as session:
        if (
            user := await session.scalar(
                select(OrmUser).where(OrmUser.id == user_id).options(joinedload(OrmUser.role))
            )
        ) is None:
            raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="User not found")
    user_role = UserRole(user.role.name)
    issued_at = datetime.now(timezone.utc)
    refresh_token_claims = RefreshTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + PHOENIX_TOKEN_MAX_AGE,
        attributes=RefreshTokenAttributes(
            user_role=user_role,
        ),
    )
    refresh_token, refresh_token_id = await token_store.create_refresh_token(refresh_token_claims)
    access_token_claims = AccessTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + PHOENIX_TOKEN_MAX_AGE,
        attributes=AccessTokenAttributes(
            user_role=user_role,
            refresh_token_id=refresh_token_id,
        ),
    )
    access_token, _ = await token_store.create_access_token(access_token_claims)
    response = Response(status_code=HTTP_204_NO_CONTENT)
    response = set_access_token_cookie(response, access_token)
    response = set_refresh_token_cookie(response, refresh_token)
    return response


LOGIN_FAILED_MESSAGE = "Invalid email and/or password"
