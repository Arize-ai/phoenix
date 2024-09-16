from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict, Optional

from authlib.integrations.starlette_client import OAuthError
from authlib.integrations.starlette_client import StarletteOAuth2App as OAuthClient
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy import and_, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from starlette.responses import RedirectResponse
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_404_NOT_FOUND
from typing_extensions import Annotated

from phoenix.auth import (
    set_access_token_cookie,
    set_refresh_token_cookie,
)
from phoenix.db import models
from phoenix.db.enums import AuthMethod, UserRole
from phoenix.server.bearer_auth import create_access_and_refresh_tokens
from phoenix.server.jwt_store import JwtStore
from phoenix.server.rate_limiters import ServerRateLimiter, fastapi_rate_limiter

ALPHANUMS_AND_UNDERSCORES = r"[a-z0-9_]+"

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


@router.post("/{idp_name}/login")
async def login(
    request: Request,
    idp_name: Annotated[str, Path(min_length=1, pattern=ALPHANUMS_AND_UNDERSCORES)],
) -> RedirectResponse:
    if not isinstance(
        oauth_client := request.app.state.oauth_clients.get_client(idp_name), OAuthClient
    ):
        raise HTTPException(HTTP_404_NOT_FOUND, f"Unknown IDP: {idp_name}")
    redirect_uri = request.url_for("create_tokens", idp_name=idp_name)
    response: RedirectResponse = await oauth_client.authorize_redirect(request, redirect_uri)
    return response


@router.get("/{idp_name}/tokens")
async def create_tokens(
    request: Request,
    idp_name: Annotated[str, Path(min_length=1, pattern=ALPHANUMS_AND_UNDERSCORES)],
) -> RedirectResponse:
    assert isinstance(access_token_expiry := request.app.state.access_token_expiry, timedelta)
    assert isinstance(refresh_token_expiry := request.app.state.refresh_token_expiry, timedelta)
    token_store: JwtStore = request.app.state.get_token_store()
    if not isinstance(
        oauth_client := request.app.state.oauth_clients.get_client(idp_name), OAuthClient
    ):
        raise HTTPException(HTTP_404_NOT_FOUND, f"Unknown IDP: {idp_name}")
    try:
        token = await oauth_client.authorize_access_token(request)
    except OAuthError as error:
        raise HTTPException(HTTP_401_UNAUTHORIZED, detail=str(error))
    user_info = _get_user_info(token)
    async with request.app.state.db() as session:
        user = await _ensure_user_exists_and_is_up_to_date(
            session, idp_name=idp_name, user_info=user_info
        )
    access_token, refresh_token = await create_access_and_refresh_tokens(
        user=user,
        token_store=token_store,
        access_token_expiry=access_token_expiry,
        refresh_token_expiry=refresh_token_expiry,
    )
    response = RedirectResponse(url="/")
    response = set_access_token_cookie(
        response=response, access_token=access_token, max_age=access_token_expiry
    )
    response = set_refresh_token_cookie(
        response=response, refresh_token=refresh_token, max_age=refresh_token_expiry
    )
    return response


@dataclass
class UserInfo:
    idp_user_id: str
    email: str
    username: Optional[str]
    profile_picture_url: Optional[str]


def _get_user_info(token: Dict[str, Any]) -> UserInfo:
    assert isinstance(token.get("access_token"), str)
    assert isinstance(token_type := token.get("token_type"), str)
    assert token_type.lower() == "bearer"
    assert isinstance(user_info := token.get("userinfo"), dict)
    assert isinstance(subject := user_info.get("sub"), (str, int))
    idp_user_id = str(subject)
    assert isinstance(email := user_info.get("email"), str)
    assert isinstance(username := user_info.get("name"), str) or username is None
    assert (
        isinstance(profile_picture_url := user_info.get("picture"), str)
        or profile_picture_url is None
    )
    return UserInfo(
        idp_user_id=idp_user_id,
        email=email,
        username=username,
        profile_picture_url=profile_picture_url,
    )


async def _ensure_identity_provider_exists(
    session: AsyncSession, /, *, idp_name: str
) -> models.IdentityProvider:
    idp = await session.scalar(
        select(models.IdentityProvider).where(
            and_(
                models.IdentityProvider.name == idp_name,
                models.IdentityProvider.auth_method == AuthMethod.OAUTH.value,
            )
        )
    )
    if idp is not None:
        return idp
    idp = await session.scalar(
        insert(models.IdentityProvider)
        .returning(models.IdentityProvider)
        .values(name=idp_name, auth_method=AuthMethod.OAUTH.value)
    )
    assert isinstance(idp, models.IdentityProvider)
    return idp


async def _ensure_user_exists_and_is_up_to_date(
    session: AsyncSession, /, *, idp_name: str, user_info: UserInfo
) -> models.User:
    idp = await _ensure_identity_provider_exists(session, idp_name=idp_name)
    user = await _get_user(session, idp_id=idp.id, idp_user_id=user_info.idp_user_id)
    if user is None:
        user = await _create_user(session, user_info=user_info, idp=idp)
    elif _db_user_is_outdated(user=user, user_info=user_info):
        user = await _update_user(session, user_id=user.id, user_info=user_info)
    return user


async def _get_user(
    session: AsyncSession, /, *, idp_id: int, idp_user_id: str
) -> Optional[models.User]:
    user = await session.scalar(
        select(models.User)
        .where(
            and_(
                models.User.identity_provider_id == idp_id,
                models.User.identity_provider_user_id == idp_user_id,
            )
        )
        .options(joinedload(models.User.role))
    )
    return user


async def _ensure_email_and_username_are_not_used_by_other_idps(
    session: AsyncSession, /, *, email: str, username: Optional[str], idp_id: int, idp_name: str
) -> None:
    # todo: simplify query
    conflicting_users = (
        await session.scalars(
            select(models.User).where(
                and_(
                    or_(models.User.email == email, models.User.username == username),
                    models.User.identity_provider_id != idp_id,
                )
            )
        )
    ).all()
    for user in conflicting_users:
        if user.email == email:
            raise EmailAlreadyInUse(
                f"An account for {email} is already in use. "
                f"This email cannot be re-used with {idp_name} OAuth."
            )
        if username and user.username == username:
            raise UsernameAlreadyInUse(
                f"An account already exists with username {username}. "
                f"This username cannot be re-used with {idp_name} OAuth."
            )
    return None


async def _create_user(
    session: AsyncSession,
    /,
    *,
    user_info: UserInfo,
    idp: models.IdentityProvider,
) -> models.User:
    await _ensure_email_and_username_are_not_used_by_other_idps(
        session,
        email=user_info.email,
        username=user_info.username,
        idp_id=idp.id,
        idp_name=idp.name,
    )
    member_role_id = (
        select(models.UserRole.id)
        .where(models.UserRole.name == UserRole.MEMBER.value)
        .scalar_subquery()
    )
    user = await session.scalar(
        insert(models.User)
        .returning(models.User)
        .values(
            user_role_id=member_role_id,
            identity_provider_id=idp.id,
            identity_provider_user_id=user_info.idp_user_id,
            username=user_info.username,
            email=user_info.email,
            profile_picture_url=user_info.profile_picture_url,
            password_hash=None,
            password_salt=None,
            reset_password=False,
        )
        .options(joinedload(models.User.role))
    )
    assert isinstance(user, models.User)
    return user


async def _update_user(
    session: AsyncSession, /, *, user_id: int, user_info: UserInfo
) -> models.User:
    user = await session.scalar(
        update(models.User)
        .where(models.User.id == user_id)
        .returning(models.User)
        .values(
            username=user_info.username,
            email=user_info.email,
            profile_picture_url=user_info.profile_picture_url,
        )
        .options(joinedload(models.User.role))
    )
    assert isinstance(user, models.User)
    return user


def _db_user_is_outdated(*, user: models.User, user_info: UserInfo) -> bool:
    return (
        user.email != user_info.email
        or user.username != user_info.username
        or user.profile_picture_url != user_info.profile_picture_url
    )


class EmailAlreadyInUse(Exception):
    pass


class UsernameAlreadyInUse(Exception):
    pass
