from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict, Optional

from authlib.integrations.starlette_client import OAuthError
from authlib.integrations.starlette_client import StarletteOAuth2App as OAuth2Client
from fastapi import APIRouter, Path, Request
from sqlalchemy import Boolean, and_, case, cast, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from starlette.datastructures import URL
from starlette.responses import RedirectResponse
from typing_extensions import Annotated

from phoenix.auth import (
    set_access_token_cookie,
    set_refresh_token_cookie,
)
from phoenix.db import models
from phoenix.db.enums import UserRole
from phoenix.server.bearer_auth import create_access_and_refresh_tokens
from phoenix.server.jwt_store import JwtStore

_LOWERCASE_ALPHANUMS_AND_UNDERSCORES = r"[a-z0-9_]+"


router = APIRouter(prefix="/oauth2", include_in_schema=False)


@router.post("/{idp_name}/login")
async def login(
    request: Request,
    idp_name: Annotated[str, Path(min_length=1, pattern=_LOWERCASE_ALPHANUMS_AND_UNDERSCORES)],
) -> RedirectResponse:
    if not isinstance(
        oauth2_client := request.app.state.oauth2_clients.get_client(idp_name), OAuth2Client
    ):
        return _redirect_to_login(error=f"Unknown IDP: {idp_name}.")
    redirect_uri = request.url_for("create_tokens", idp_name=idp_name)
    response: RedirectResponse = await oauth2_client.authorize_redirect(request, redirect_uri)
    return response


@router.get("/{idp_name}/tokens")
async def create_tokens(
    request: Request,
    idp_name: Annotated[str, Path(min_length=1, pattern=_LOWERCASE_ALPHANUMS_AND_UNDERSCORES)],
) -> RedirectResponse:
    assert isinstance(access_token_expiry := request.app.state.access_token_expiry, timedelta)
    assert isinstance(refresh_token_expiry := request.app.state.refresh_token_expiry, timedelta)
    token_store: JwtStore = request.app.state.get_token_store()
    if not isinstance(
        oauth2_client := request.app.state.oauth2_clients.get_client(idp_name), OAuth2Client
    ):
        return _redirect_to_login(error=f"Unknown IDP: {idp_name}.")
    try:
        token_data = await oauth2_client.authorize_access_token(request)
    except OAuthError as error:
        return _redirect_to_login(error=str(error))
    if (user_info := _get_user_info(token_data)) is None:
        return _redirect_to_login(
            error=f"OAuth2 IDP {idp_name} does not appear to support OpenID Connect."
        )
    try:
        async with request.app.state.db() as session:
            user = await _ensure_user_exists_and_is_up_to_date(
                session,
                oauth2_client_id=str(oauth2_client.client_id),
                user_info=user_info,
            )
    except (EmailAlreadyInUse, UsernameAlreadyInUse) as error:
        return _redirect_to_login(error=str(error))
    access_token, refresh_token = await create_access_and_refresh_tokens(
        user=user,
        token_store=token_store,
        access_token_expiry=access_token_expiry,
        refresh_token_expiry=refresh_token_expiry,
    )
    response = RedirectResponse(url="/")  # todo: sanitize a return url
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


def _get_user_info(token_data: Dict[str, Any]) -> Optional[UserInfo]:
    """
    Parses token data and extracts user info if available.
    """
    assert isinstance(token_data.get("access_token"), str)
    assert isinstance(token_type := token_data.get("token_type"), str)
    assert token_type.lower() == "bearer"
    if (user_info := token_data.get("userinfo")) is None:
        return None
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


async def _ensure_user_exists_and_is_up_to_date(
    session: AsyncSession, /, *, oauth2_client_id: str, user_info: UserInfo
) -> models.User:
    user = await _get_user(
        session,
        oauth2_client_id=oauth2_client_id,
        idp_user_id=user_info.idp_user_id,
    )
    if user is None:
        user = await _create_user(session, oauth2_client_id=oauth2_client_id, user_info=user_info)
    elif not _user_is_up_to_date(user=user, user_info=user_info):
        user = await _update_user(session, user_id=user.id, user_info=user_info)
    return user


async def _get_user(
    session: AsyncSession, /, *, oauth2_client_id: str, idp_user_id: str
) -> Optional[models.User]:
    """
    Retrieves the user uniquely identified by the given OAuth2 client ID and IDP
    user ID.
    """
    user = await session.scalar(
        select(models.User)
        .where(
            and_(
                models.User.oauth2_client_id == oauth2_client_id,
                models.User.oauth2_user_id == idp_user_id,
            )
        )
        .options(joinedload(models.User.role))
    )
    return user


async def _create_user(
    session: AsyncSession,
    /,
    *,
    oauth2_client_id: str,
    user_info: UserInfo,
) -> models.User:
    """
    Creates a new user with the user info from the IDP.
    """
    await _ensure_email_and_username_are_not_in_use(
        session,
        email=user_info.email,
        username=user_info.username,
    )
    member_role_id = (
        select(models.UserRole.id)
        .where(models.UserRole.name == UserRole.MEMBER.value)
        .scalar_subquery()
    )
    user_id = await session.scalar(
        insert(models.User)
        .returning(models.User.id)
        .values(
            user_role_id=member_role_id,
            oauth2_client_id=oauth2_client_id,
            oauth2_user_id=user_info.idp_user_id,
            username=user_info.username,
            email=user_info.email,
            profile_picture_url=user_info.profile_picture_url,
        )
    )
    assert isinstance(user_id, int)
    user = await session.scalar(
        select(models.User).where(models.User.id == user_id).options(joinedload(models.User.role))
    )  # query user again for joined load
    assert isinstance(user, models.User)
    return user


async def _update_user(
    session: AsyncSession, /, *, user_id: int, user_info: UserInfo
) -> models.User:
    """
    Updates an existing user with user info from the IDP.
    """
    await _ensure_email_and_username_are_not_in_use(
        session,
        email=user_info.email,
        username=user_info.username,
    )
    await session.execute(
        update(models.User)
        .where(models.User.id == user_id)
        .values(
            username=user_info.username,
            email=user_info.email,
            profile_picture_url=user_info.profile_picture_url,
        )
        .options(joinedload(models.User.role))
    )
    user = await session.scalar(
        select(models.User).where(models.User.id == user_id).options(joinedload(models.User.role))
    )  # query user again for joined load
    assert isinstance(user, models.User)
    return user


async def _ensure_email_and_username_are_not_in_use(
    session: AsyncSession, /, *, email: str, username: Optional[str]
) -> None:
    """
    Raises an error if the email or username are already in use.
    """
    [(email_exists, username_exists)] = (
        await session.execute(
            select(
                cast(
                    func.coalesce(
                        func.max(case((models.User.email == email, 1), else_=0)),
                        0,
                    ),
                    Boolean,
                ).label("email_exists"),
                cast(
                    func.coalesce(
                        func.max(case((models.User.username == username, 1), else_=0)),
                        0,
                    ),
                    Boolean,
                ).label("username_exists"),
            ).where(or_(models.User.email == email, models.User.username == username))
        )
    ).all()
    if email_exists:
        raise EmailAlreadyInUse(f"An account for {email} is already in use.")
    if username_exists:
        raise UsernameAlreadyInUse(f'An account already exists with username "{username}".')


def _user_is_up_to_date(*, user: models.User, user_info: UserInfo) -> bool:
    """
    Determines whether the user's tuple in the database is up-to-date with the
    IDP's user info.
    """
    return (
        user.email == user_info.email
        and user.username == user_info.username
        and user.profile_picture_url == user_info.profile_picture_url
    )


class EmailAlreadyInUse(Exception):
    pass


class UsernameAlreadyInUse(Exception):
    pass


def _redirect_to_login(*, error: str) -> RedirectResponse:
    """
    Creates a RedirectResponse to the login page to display an error message.
    """
    return RedirectResponse(url=URL("/login").include_query_params(error=error))
