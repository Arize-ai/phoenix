import re
from dataclasses import dataclass
from datetime import timedelta
from random import randrange
from typing import Any, Optional, TypedDict
from urllib.parse import unquote, urlparse

from authlib.common.security import generate_token
from authlib.integrations.starlette_client import OAuthError
from authlib.jose import jwt
from authlib.jose.errors import JoseError
from fastapi import APIRouter, Cookie, Depends, Path, Query, Request
from sqlalchemy import Boolean, and_, case, cast, func, insert, or_, select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.datastructures import URL, URLPath
from starlette.responses import RedirectResponse
from starlette.routing import Router
from starlette.status import HTTP_302_FOUND
from typing_extensions import Annotated, NotRequired, TypeGuard

from phoenix.auth import (
    DEFAULT_OAUTH2_LOGIN_EXPIRY_MINUTES,
    PHOENIX_OAUTH2_NONCE_COOKIE_NAME,
    PHOENIX_OAUTH2_STATE_COOKIE_NAME,
    delete_oauth2_nonce_cookie,
    delete_oauth2_state_cookie,
    set_access_token_cookie,
    set_oauth2_nonce_cookie,
    set_oauth2_state_cookie,
    set_refresh_token_cookie,
)
from phoenix.config import get_env_disable_rate_limit
from phoenix.db import models
from phoenix.db.enums import UserRole
from phoenix.server.bearer_auth import create_access_and_refresh_tokens
from phoenix.server.oauth2 import OAuth2Client
from phoenix.server.rate_limiters import (
    ServerRateLimiter,
    fastapi_ip_rate_limiter,
    fastapi_route_rate_limiter,
)
from phoenix.server.types import TokenStore

_LOWERCASE_ALPHANUMS_AND_UNDERSCORES = r"[a-z0-9_]+"

login_rate_limiter = fastapi_ip_rate_limiter(
    ServerRateLimiter(
        per_second_rate_limit=0.2,
        enforcement_window_seconds=30,
        partition_seconds=60,
        active_partitions=2,
    ),
)

create_tokens_rate_limiter = fastapi_route_rate_limiter(
    ServerRateLimiter(
        per_second_rate_limit=0.5,
        enforcement_window_seconds=30,
        partition_seconds=60,
        active_partitions=2,
    )
)

router = APIRouter(
    prefix="/oauth2",
    include_in_schema=False,
)

if not get_env_disable_rate_limit():
    login_dependencies = [Depends(login_rate_limiter)]
    create_tokens_dependencies = [Depends(create_tokens_rate_limiter)]
else:
    login_dependencies = []
    create_tokens_dependencies = []


@router.post("/{idp_name}/login", dependencies=login_dependencies)
async def login(
    request: Request,
    idp_name: Annotated[str, Path(min_length=1, pattern=_LOWERCASE_ALPHANUMS_AND_UNDERSCORES)],
    return_url: Optional[str] = Query(default=None, alias="returnUrl"),
) -> RedirectResponse:
    secret = request.app.state.get_secret()
    if not isinstance(
        oauth2_client := request.app.state.oauth2_clients.get_client(idp_name), OAuth2Client
    ):
        return _redirect_to_login(request=request, error=f"Unknown IDP: {idp_name}.")
    if (referer := request.headers.get("referer")) is not None:
        # if the referer header is present, use it as the origin URL
        parsed_url = urlparse(referer)
        origin_url = _append_root_path_if_exists(
            request=request, base_url=f"{parsed_url.scheme}://{parsed_url.netloc}"
        )
    else:
        # fall back to the base url as the origin URL
        origin_url = str(request.base_url)
    authorization_url_data = await oauth2_client.create_authorization_url(
        redirect_uri=_get_create_tokens_endpoint(
            request=request, origin_url=origin_url, idp_name=idp_name
        ),
        state=_generate_state_for_oauth2_authorization_code_flow(
            secret=secret, origin_url=origin_url, return_url=return_url
        ),
    )
    assert isinstance(authorization_url := authorization_url_data.get("url"), str)
    assert isinstance(state := authorization_url_data.get("state"), str)
    assert isinstance(nonce := authorization_url_data.get("nonce"), str)
    response = RedirectResponse(url=authorization_url, status_code=HTTP_302_FOUND)
    response = set_oauth2_state_cookie(
        response=response,
        state=state,
        max_age=timedelta(minutes=DEFAULT_OAUTH2_LOGIN_EXPIRY_MINUTES),
    )
    response = set_oauth2_nonce_cookie(
        response=response,
        nonce=nonce,
        max_age=timedelta(minutes=DEFAULT_OAUTH2_LOGIN_EXPIRY_MINUTES),
    )
    return response


@router.get("/{idp_name}/tokens", dependencies=create_tokens_dependencies)
async def create_tokens(
    request: Request,
    idp_name: Annotated[str, Path(min_length=1, pattern=_LOWERCASE_ALPHANUMS_AND_UNDERSCORES)],
    state: str = Query(),
    authorization_code: str = Query(alias="code"),
    stored_state: str = Cookie(alias=PHOENIX_OAUTH2_STATE_COOKIE_NAME),
    stored_nonce: str = Cookie(alias=PHOENIX_OAUTH2_NONCE_COOKIE_NAME),
) -> RedirectResponse:
    secret = request.app.state.get_secret()
    if state != stored_state:
        return _redirect_to_login(request=request, error=_INVALID_OAUTH2_STATE_MESSAGE)
    try:
        payload = _parse_state_payload(secret=secret, state=state)
    except JoseError:
        return _redirect_to_login(request=request, error=_INVALID_OAUTH2_STATE_MESSAGE)
    if (return_url := payload.get("return_url")) is not None and not _is_relative_url(
        unquote(return_url)
    ):
        return _redirect_to_login(request=request, error="Attempting login with unsafe return URL.")
    assert isinstance(access_token_expiry := request.app.state.access_token_expiry, timedelta)
    assert isinstance(refresh_token_expiry := request.app.state.refresh_token_expiry, timedelta)
    token_store: TokenStore = request.app.state.get_token_store()
    if not isinstance(
        oauth2_client := request.app.state.oauth2_clients.get_client(idp_name), OAuth2Client
    ):
        return _redirect_to_login(request=request, error=f"Unknown IDP: {idp_name}.")
    try:
        token_data = await oauth2_client.fetch_access_token(
            state=state,
            code=authorization_code,
            redirect_uri=_get_create_tokens_endpoint(
                request=request, origin_url=payload["origin_url"], idp_name=idp_name
            ),
        )
    except OAuthError as error:
        return _redirect_to_login(request=request, error=str(error))
    _validate_token_data(token_data)
    if "id_token" not in token_data:
        return _redirect_to_login(
            request=request,
            error=f"OAuth2 IDP {idp_name} does not appear to support OpenID Connect.",
        )
    user_info = await oauth2_client.parse_id_token(token_data, nonce=stored_nonce)
    user_info = _parse_user_info(user_info)
    try:
        async with request.app.state.db() as session:
            user = await _ensure_user_exists_and_is_up_to_date(
                session,
                oauth2_client_id=str(oauth2_client.client_id),
                user_info=user_info,
            )
    except EmailAlreadyInUse as error:
        return _redirect_to_login(request=request, error=str(error))
    access_token, refresh_token = await create_access_and_refresh_tokens(
        user=user,
        token_store=token_store,
        access_token_expiry=access_token_expiry,
        refresh_token_expiry=refresh_token_expiry,
    )
    redirect_path = _prepend_root_path_if_exists(request=request, path=return_url or "/")
    response = RedirectResponse(
        url=redirect_path,
        status_code=HTTP_302_FOUND,
    )
    response = set_access_token_cookie(
        response=response, access_token=access_token, max_age=access_token_expiry
    )
    response = set_refresh_token_cookie(
        response=response, refresh_token=refresh_token, max_age=refresh_token_expiry
    )
    response = delete_oauth2_state_cookie(response)
    response = delete_oauth2_nonce_cookie(response)
    return response


@dataclass
class UserInfo:
    idp_user_id: str
    email: str
    username: Optional[str]
    profile_picture_url: Optional[str]


def _validate_token_data(token_data: dict[str, Any]) -> None:
    """
    Performs basic validations on the token data returned by the IDP.
    """
    assert isinstance(token_data.get("access_token"), str)
    assert isinstance(token_type := token_data.get("token_type"), str)
    assert token_type.lower() == "bearer"


def _parse_user_info(user_info: dict[str, Any]) -> UserInfo:
    """
    Parses user info from the IDP's ID token.
    """
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
    elif user.email != user_info.email:
        user = await _update_user_email(session, user_id=user.id, email=user_info.email)
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
    email_exists, username_exists = await _email_and_username_exist(
        session,
        email=(email := user_info.email),
        username=(username := user_info.username),
    )
    if email_exists:
        raise EmailAlreadyInUse(f"An account for {email} is already in use.")
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
            username=_with_random_suffix(username) if username and username_exists else username,
            email=email,
            profile_picture_url=user_info.profile_picture_url,
            reset_password=False,
        )
    )
    assert isinstance(user_id, int)
    user = await session.scalar(
        select(models.User).where(models.User.id == user_id).options(joinedload(models.User.role))
    )  # query user again for joined load
    assert isinstance(user, models.User)
    return user


async def _update_user_email(session: AsyncSession, /, *, user_id: int, email: str) -> models.User:
    """
    Updates an existing user's email.
    """
    try:
        await session.execute(
            update(models.User)
            .where(models.User.id == user_id)
            .values(email=email)
            .options(joinedload(models.User.role))
        )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise EmailAlreadyInUse(f"An account for {email} is already in use.")
    user = await session.scalar(
        select(models.User).where(models.User.id == user_id).options(joinedload(models.User.role))
    )  # query user again for joined load
    assert isinstance(user, models.User)
    return user


async def _email_and_username_exist(
    session: AsyncSession, /, *, email: str, username: Optional[str]
) -> tuple[bool, bool]:
    """
    Checks whether the email and username are already in use.
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
    return email_exists, username_exists


class EmailAlreadyInUse(Exception):
    pass


def _redirect_to_login(*, request: Request, error: str) -> RedirectResponse:
    """
    Creates a RedirectResponse to the login page to display an error message.
    """
    login_path = _prepend_root_path_if_exists(request=request, path="/login")
    url = URL(login_path).include_query_params(error=error)
    response = RedirectResponse(url=url)
    response = delete_oauth2_state_cookie(response)
    response = delete_oauth2_nonce_cookie(response)
    return response


def _prepend_root_path_if_exists(*, request: Request, path: str) -> str:
    """
    If a root path is configured, prepends it to the input path.
    """
    if not path.startswith("/"):
        raise ValueError("path must start with a forward slash")
    root_path = _get_root_path(request=request)
    if root_path.endswith("/"):
        root_path = root_path.rstrip("/")
    return root_path + path


def _append_root_path_if_exists(*, request: Request, base_url: str) -> str:
    """
    If a root path is configured, appends it to the input base url.
    """
    if not (root_path := _get_root_path(request=request)):
        return base_url
    return str(URLPath(root_path).make_absolute_url(base_url=base_url))


def _get_root_path(*, request: Request) -> str:
    """
    Gets the root path from the request.
    """
    return str(request.scope.get("root_path", ""))


def _get_create_tokens_endpoint(*, request: Request, origin_url: str, idp_name: str) -> str:
    """
    Gets the endpoint for create tokens route.
    """
    router: Router = request.scope["router"]
    url_path = router.url_path_for(create_tokens.__name__, idp_name=idp_name)
    return str(url_path.make_absolute_url(base_url=origin_url))


def _generate_state_for_oauth2_authorization_code_flow(
    *, secret: str, origin_url: str, return_url: Optional[str]
) -> str:
    """
    Generates a JWT whose payload contains both an OAuth2 state (generated using
    the `authlib` default algorithm) and a return URL. This allows us to pass
    the return URL to the OAuth2 authorization server via the `state` query
    parameter and have it returned to us in the callback without needing to
    maintain state.
    """
    header = {"alg": _JWT_ALGORITHM}
    payload = _OAuth2StatePayload(
        random=generate_token(),
        origin_url=origin_url,
    )
    if return_url is not None:
        payload["return_url"] = return_url
    jwt_bytes: bytes = jwt.encode(header=header, payload=payload, key=secret)
    return jwt_bytes.decode()


class _OAuth2StatePayload(TypedDict):
    """
    Represents the OAuth2 state payload.
    """

    random: str
    origin_url: str
    return_url: NotRequired[str]


def _parse_state_payload(*, secret: str, state: str) -> _OAuth2StatePayload:
    """
    Validates the JWT signature and parses the return URL from the OAuth2 state.
    """
    payload = jwt.decode(s=state, key=secret)
    if _is_oauth2_state_payload(payload):
        return payload
    raise ValueError("Invalid OAuth2 state payload.")


def _is_relative_url(url: str) -> bool:
    """
    Determines whether the URL is relative.
    """
    return bool(_RELATIVE_URL_PATTERN.match(url))


def _with_random_suffix(string: str) -> str:
    """
    Appends a random suffix.
    """
    return f"{string}-{randrange(10_000, 100_000)}"


def _is_oauth2_state_payload(maybe_state_payload: Any) -> TypeGuard[_OAuth2StatePayload]:
    """
    Determines whether the given object is an OAuth2 state payload.
    """

    return (
        isinstance(maybe_state_payload, dict)
        and {"random", "origin_url"}.issubset((keys := set(maybe_state_payload.keys())))
        and keys.issubset({"random", "origin_url", "return_url"})
    )


_JWT_ALGORITHM = "HS256"
_INVALID_OAUTH2_STATE_MESSAGE = (
    "Received invalid state parameter during OAuth2 authorization code flow for IDP {idp_name}."
)
_RELATIVE_URL_PATTERN = re.compile(r"^/($|\w)")
