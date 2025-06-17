import asyncio
import secrets
from datetime import datetime, timedelta, timezone
from functools import partial
from pathlib import Path
from urllib.parse import urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from starlette.status import (
    HTTP_204_NO_CONTENT,
    HTTP_302_FOUND,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_422_UNPROCESSABLE_ENTITY,
    HTTP_503_SERVICE_UNAVAILABLE,
)

from phoenix.auth import (
    DEFAULT_SECRET_LENGTH,
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
    Token,
    compute_password_hash,
    delete_access_token_cookie,
    delete_oauth2_nonce_cookie,
    delete_oauth2_state_cookie,
    delete_refresh_token_cookie,
    is_valid_password,
    set_access_token_cookie,
    set_refresh_token_cookie,
    validate_password_format,
)
from phoenix.config import (
    get_base_url,
    get_env_disable_basic_auth,
    get_env_disable_rate_limit,
    get_env_host_root_path,
)
from phoenix.db import models
from phoenix.server.bearer_auth import PhoenixUser, create_access_and_refresh_tokens
from phoenix.server.email.types import EmailSender
from phoenix.server.rate_limiters import ServerRateLimiter, fastapi_ip_rate_limiter
from phoenix.server.types import (
    AccessTokenClaims,
    PasswordResetTokenClaims,
    PasswordResetTokenId,
    RefreshTokenClaims,
    TokenStore,
    UserId,
)

rate_limiter = ServerRateLimiter(
    per_second_rate_limit=0.2,
    enforcement_window_seconds=60,
    partition_seconds=60,
    active_partitions=2,
)
login_rate_limiter = fastapi_ip_rate_limiter(
    rate_limiter,
    paths=[
        "/auth/login",
        "/auth/logout",
        "/auth/refresh",
        "/auth/password-reset-email",
        "/auth/password-reset",
    ],
)

auth_dependencies = [Depends(login_rate_limiter)] if not get_env_disable_rate_limit() else []
router = APIRouter(prefix="/auth", include_in_schema=False, dependencies=auth_dependencies)


@router.post("/login")
async def login(request: Request) -> Response:
    if get_env_disable_basic_auth():
        raise HTTPException(status_code=HTTP_403_FORBIDDEN)
    assert isinstance(access_token_expiry := request.app.state.access_token_expiry, timedelta)
    assert isinstance(refresh_token_expiry := request.app.state.refresh_token_expiry, timedelta)
    token_store: TokenStore = request.app.state.get_token_store()
    data = await request.json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Email and password required")

    async with request.app.state.db() as session:
        user = await session.scalar(
            select(models.User).filter_by(email=email).options(joinedload(models.User.role))
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

    access_token, refresh_token = await create_access_and_refresh_tokens(
        token_store=token_store,
        user=user,
        access_token_expiry=access_token_expiry,
        refresh_token_expiry=refresh_token_expiry,
    )
    response = Response(status_code=HTTP_204_NO_CONTENT)
    response = set_access_token_cookie(
        response=response, access_token=access_token, max_age=access_token_expiry
    )
    response = set_refresh_token_cookie(
        response=response, refresh_token=refresh_token, max_age=refresh_token_expiry
    )
    return response


@router.get("/logout")
async def logout(
    request: Request,
) -> Response:
    token_store: TokenStore = request.app.state.get_token_store()
    user_id = None
    if isinstance(user := request.user, PhoenixUser):
        user_id = user.identity
    elif (refresh_token := request.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME)) and (
        isinstance(
            refresh_token_claims := await token_store.read(Token(refresh_token)),
            RefreshTokenClaims,
        )
        and isinstance(subject := refresh_token_claims.subject, UserId)
    ):
        user_id = subject
    if user_id:
        await token_store.log_out(user_id)
    redirect_url = "/logout" if get_env_disable_basic_auth() else "/login"
    response = Response(status_code=HTTP_302_FOUND, headers={"Location": redirect_url})
    response = delete_access_token_cookie(response)
    response = delete_refresh_token_cookie(response)
    response = delete_oauth2_state_cookie(response)
    response = delete_oauth2_nonce_cookie(response)
    return response


@router.post("/refresh")
async def refresh_tokens(request: Request) -> Response:
    assert isinstance(access_token_expiry := request.app.state.access_token_expiry, timedelta)
    assert isinstance(refresh_token_expiry := request.app.state.refresh_token_expiry, timedelta)
    if (refresh_token := request.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME)) is None:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    token_store: TokenStore = request.app.state.get_token_store()
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
                select(models.User).filter_by(id=user_id).options(joinedload(models.User.role))
            )
        ) is None:
            raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="User not found")
    access_token, refresh_token = await create_access_and_refresh_tokens(
        token_store=token_store,
        user=user,
        access_token_expiry=access_token_expiry,
        refresh_token_expiry=refresh_token_expiry,
    )
    response = Response(status_code=HTTP_204_NO_CONTENT)
    response = set_access_token_cookie(
        response=response, access_token=access_token, max_age=access_token_expiry
    )
    response = set_refresh_token_cookie(
        response=response, refresh_token=refresh_token, max_age=refresh_token_expiry
    )
    return response


@router.post("/password-reset-email")
async def initiate_password_reset(request: Request) -> Response:
    if get_env_disable_basic_auth():
        raise HTTPException(status_code=HTTP_403_FORBIDDEN)
    data = await request.json()
    if not (email := data.get("email")):
        raise MISSING_EMAIL
    sender: EmailSender = request.app.state.email_sender
    if sender is None:
        raise SMTP_UNAVAILABLE
    assert isinstance(token_expiry := request.app.state.password_reset_token_expiry, timedelta)
    async with request.app.state.db() as session:
        user = await session.scalar(
            select(models.User)
            .filter_by(email=email)
            .options(
                joinedload(models.User.password_reset_token).load_only(models.PasswordResetToken.id)
            )
        )
    if user is None or user.auth_method != "LOCAL":
        # Withold privileged information
        return Response(status_code=HTTP_204_NO_CONTENT)
    token_store: TokenStore = request.app.state.get_token_store()
    if user.password_reset_token:
        await token_store.revoke(PasswordResetTokenId(user.password_reset_token.id))
    password_reset_token_claims = PasswordResetTokenClaims(
        subject=UserId(user.id),
        issued_at=datetime.now(timezone.utc),
        expiration_time=datetime.now(timezone.utc) + token_expiry,
    )
    token, _ = await token_store.create_password_reset_token(password_reset_token_claims)
    url = urlparse(request.headers.get("referer") or get_base_url())
    path = Path(get_env_host_root_path()) / "reset-password-with-token"
    query_string = urlencode(dict(token=token))
    components = (url.scheme, url.netloc, path.as_posix(), "", query_string, "")
    reset_url = urlunparse(components)
    await sender.send_password_reset_email(email, reset_url)
    return Response(status_code=HTTP_204_NO_CONTENT)


@router.post("/password-reset")
async def reset_password(request: Request) -> Response:
    if get_env_disable_basic_auth():
        raise HTTPException(status_code=HTTP_403_FORBIDDEN)
    data = await request.json()
    if not (password := data.get("password")):
        raise MISSING_PASSWORD
    token_store: TokenStore = request.app.state.get_token_store()
    if (
        not (token := data.get("token"))
        or not isinstance((claims := await token_store.read(token)), PasswordResetTokenClaims)
        or not claims.expiration_time
        or claims.expiration_time < datetime.now(timezone.utc)
    ):
        raise INVALID_TOKEN
    assert (user_id := claims.subject)
    async with request.app.state.db() as session:
        user = await session.scalar(select(models.User).filter_by(id=int(user_id)))
    if user is None or user.auth_method != "LOCAL":
        # Withold privileged information
        return Response(status_code=HTTP_204_NO_CONTENT)
    validate_password_format(password)
    user.password_salt = secrets.token_bytes(DEFAULT_SECRET_LENGTH)
    loop = asyncio.get_running_loop()
    user.password_hash = await loop.run_in_executor(
        None, partial(compute_password_hash, password=password, salt=user.password_salt)
    )
    user.reset_password = False
    async with request.app.state.db() as session:
        session.add(user)
        await session.flush()
    response = Response(status_code=HTTP_204_NO_CONTENT)
    assert (token_id := claims.token_id)
    await token_store.revoke(token_id)
    await token_store.log_out(UserId(user.id))
    return response


LOGIN_FAILED_MESSAGE = "Invalid email and/or password"

MISSING_EMAIL = HTTPException(
    status_code=HTTP_422_UNPROCESSABLE_ENTITY,
    detail="Email required",
)
MISSING_PASSWORD = HTTPException(
    status_code=HTTP_422_UNPROCESSABLE_ENTITY,
    detail="Password required",
)
SMTP_UNAVAILABLE = HTTPException(
    status_code=HTTP_503_SERVICE_UNAVAILABLE,
    detail="SMTP server not configured",
)
INVALID_TOKEN = HTTPException(
    status_code=HTTP_401_UNAUTHORIZED,
    detail="Invalid token",
)
