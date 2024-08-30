from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import and_, select
from sqlalchemy.orm import joinedload
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_404_NOT_FOUND

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_MAX_AGE,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_MAX_AGE,
    Token,
    is_valid_password,
    set_access_token_cookie,
    set_refresh_token_cookie,
)
from phoenix.db.enums import UserRole
from phoenix.db.models import User as OrmUser
from phoenix.server.jwt_store import JwtStore
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    RefreshTokenAttributes,
    RefreshTokenClaims,
    UserId,
)

router = APIRouter(prefix="/auth", include_in_schema=False)


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
        if user is None or user.password_hash is None:
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
            )

    assert user.password_salt is not None
    if not await is_valid_password(
        password=password,
        salt=user.password_salt,
        password_hash=user.password_hash,
    ):
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    issued_at = datetime.now(timezone.utc)
    refresh_token_claims = RefreshTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + PHOENIX_REFRESH_TOKEN_MAX_AGE,
        attributes=RefreshTokenAttributes(
            user_role=UserRole(user.role.name),
        ),
    )
    token_store: JwtStore = request.app.state.get_token_store()
    refresh_token, refresh_token_id = await token_store.create_refresh_token(refresh_token_claims)
    access_token_claims = AccessTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + PHOENIX_ACCESS_TOKEN_MAX_AGE,
        attributes=AccessTokenAttributes(
            user_role=UserRole(user.role.name),
            refresh_token_id=refresh_token_id,
        ),
    )
    access_token, _ = await token_store.create_access_token(access_token_claims)
    response = Response()
    response = set_access_token_cookie(response, access_token)
    response = set_refresh_token_cookie(response, refresh_token)
    return response


@router.post("/refresh")
async def refresh_tokens(request: Request) -> Response:
    if (refresh_token := request.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME)) is None:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    token_store: JwtStore = request.app.state.get_token_store()
    claims = await token_store.read(Token(refresh_token))
    if (
        not isinstance(claims, RefreshTokenClaims)
        or (token_id := claims.token_id) is None
        or (user_id := claims.subject) is None
        or (expiration_time := claims.expiration_time) is None
    ):
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if expiration_time.timestamp() < datetime.now().timestamp():
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Expired refresh token")

    await token_store.revoke(token_id)

    async with request.app.state.db() as session:
        if (
            user := await session.execute(
                select(OrmUser).where(and_(OrmUser.id == user_id)).options(joinedload(OrmUser.role))
            )
        ) is None:
            raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="User not found")
    user_role = UserRole(user.role.name)
    issued_at = datetime.now(timezone.utc)
    refresh_token_claims = RefreshTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + PHOENIX_REFRESH_TOKEN_MAX_AGE,
        attributes=RefreshTokenAttributes(
            user_role=user_role,
        ),
    )
    refresh_token, refresh_token_id = await token_store.create_refresh_token(refresh_token_claims)
    access_token_claims = AccessTokenClaims(
        subject=UserId(user.id),
        issued_at=issued_at,
        expiration_time=issued_at + PHOENIX_ACCESS_TOKEN_MAX_AGE,
        attributes=AccessTokenAttributes(
            user_role=user_role,
            refresh_token_id=refresh_token_id,
        ),
    )
    access_token, _ = await token_store.create_access_token(access_token_claims)
    response = Response()
    response = set_access_token_cookie(response, access_token)
    response = set_refresh_token_cookie(response, refresh_token)
    return response
