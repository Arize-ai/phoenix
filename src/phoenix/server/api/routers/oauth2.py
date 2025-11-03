import logging
import re
from dataclasses import dataclass, field
from datetime import timedelta
from random import randrange
from typing import Any, Optional, TypedDict
from urllib.parse import unquote, urlparse

from authlib.common.security import generate_token
from authlib.integrations.starlette_client import OAuthError
from authlib.jose import jwt
from authlib.jose.errors import JoseError
from fastapi import APIRouter, Cookie, Depends, Path, Query, Request
from sqlalchemy import Boolean, and_, case, cast, func, insert, or_, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.datastructures import URL, Secret, URLPath
from starlette.responses import RedirectResponse
from starlette.routing import Router
from typing_extensions import Annotated, NotRequired, TypeGuard

from phoenix.auth import (
    DEFAULT_OAUTH2_LOGIN_EXPIRY_MINUTES,
    PHOENIX_OAUTH2_CODE_VERIFIER_COOKIE_NAME,
    PHOENIX_OAUTH2_NONCE_COOKIE_NAME,
    PHOENIX_OAUTH2_STATE_COOKIE_NAME,
    delete_oauth2_code_verifier_cookie,
    delete_oauth2_nonce_cookie,
    delete_oauth2_state_cookie,
    sanitize_email,
    set_access_token_cookie,
    set_oauth2_code_verifier_cookie,
    set_oauth2_nonce_cookie,
    set_oauth2_state_cookie,
    set_refresh_token_cookie,
)
from phoenix.config import (
    OAuth2UserRoleName,
    get_env_disable_basic_auth,
    get_env_disable_rate_limit,
)
from phoenix.db import models
from phoenix.server.api.auth_messages import AuthErrorCode
from phoenix.server.bearer_auth import create_access_and_refresh_tokens
from phoenix.server.oauth2 import OAuth2Client
from phoenix.server.rate_limiters import (
    ServerRateLimiter,
    fastapi_ip_rate_limiter,
    fastapi_route_rate_limiter,
)
from phoenix.server.types import TokenStore
from phoenix.server.utils import get_root_path, prepend_root_path

_LOWERCASE_ALPHANUMS_AND_UNDERSCORES = r"[a-z0-9_]+"

logger = logging.getLogger(__name__)

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


@router.get("/{idp_name}/login", dependencies=login_dependencies)
@router.post("/{idp_name}/login", dependencies=login_dependencies)
async def login(
    request: Request,
    idp_name: Annotated[str, Path(min_length=1, pattern=_LOWERCASE_ALPHANUMS_AND_UNDERSCORES)],
    return_url: Optional[str] = Query(default=None, alias="returnUrl"),
) -> RedirectResponse:
    # Security Note: Query parameters should be treated as untrusted user input. Never display
    # these values directly to users as they could be manipulated for XSS, phishing, or social
    # engineering attacks.
    if (oauth2_client := request.app.state.oauth2_clients.get_client(idp_name)) is None:
        return _redirect_to_login(request=request, error="unknown_idp")
    secret = request.app.state.get_secret()
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
    response = RedirectResponse(url=authorization_url, status_code=302)
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
    if code_verifier := authorization_url_data.get("code_verifier"):
        response = set_oauth2_code_verifier_cookie(
            response=response,
            code_verifier=code_verifier,
            max_age=timedelta(minutes=DEFAULT_OAUTH2_LOGIN_EXPIRY_MINUTES),
        )
    return response


@router.get("/{idp_name}/tokens", dependencies=create_tokens_dependencies)
async def create_tokens(
    request: Request,
    idp_name: Annotated[str, Path(min_length=1, pattern=_LOWERCASE_ALPHANUMS_AND_UNDERSCORES)],
    state: str = Query(),  # RFC 6749 §4.1.1: CSRF protection via state parameter
    authorization_code: Optional[str] = Query(default=None, alias="code"),  # RFC 6749 §4.1.2
    error: Optional[str] = Query(default=None),  # RFC 6749 §4.1.2.1: Error response
    error_description: Optional[str] = Query(default=None),
    stored_state: str = Cookie(alias=PHOENIX_OAUTH2_STATE_COOKIE_NAME),
    stored_nonce: str = Cookie(alias=PHOENIX_OAUTH2_NONCE_COOKIE_NAME),  # OIDC Core §3.1.2.1
    code_verifier: Optional[str] = Cookie(
        default=None, alias=PHOENIX_OAUTH2_CODE_VERIFIER_COOKIE_NAME
    ),  # RFC 7636 §4.1
) -> RedirectResponse:
    # Security Note: Query parameters should be treated as untrusted user input. Never display
    # these values directly to users as they could be manipulated for XSS, phishing, or social
    # engineering attacks.
    if (oauth2_client := request.app.state.oauth2_clients.get_client(idp_name)) is None:
        return _redirect_to_login(request=request, error="unknown_idp")
    if error or error_description:
        logger.error(
            "OAuth2 authentication failed for IDP %s: error=%s, description=%s",
            idp_name,
            error,
            error_description,
        )
        return _redirect_to_login(request=request, error="auth_failed")
    if authorization_code is None:
        logger.error("OAuth2 callback missing authorization code for IDP %s", idp_name)
        return _redirect_to_login(request=request, error="auth_failed")
    secret = request.app.state.get_secret()
    # RFC 6749 §10.12: CSRF protection - validate state parameter
    if state != stored_state:
        return _redirect_to_login(request=request, error="invalid_state")
    try:
        payload = _parse_state_payload(secret=secret, state=state)
    except JoseError:
        return _redirect_to_login(request=request, error="invalid_state")
    if (return_url := payload.get("return_url")) is not None and not _is_relative_url(
        unquote(return_url)
    ):
        return _redirect_to_login(request=request, error="unsafe_return_url")
    assert isinstance(access_token_expiry := request.app.state.access_token_expiry, timedelta)
    assert isinstance(refresh_token_expiry := request.app.state.refresh_token_expiry, timedelta)
    token_store: TokenStore = request.app.state.get_token_store()
    try:
        # RFC 6749 §4.1.3: Token request - exchange authorization code for tokens
        fetch_kwargs: dict[str, Any] = dict(
            state=state,
            code=authorization_code,
            redirect_uri=_get_create_tokens_endpoint(  # RFC 6749 §3.1.2
                request=request, origin_url=payload["origin_url"], idp_name=idp_name
            ),
        )
        # PKCE validation: code_verifier is required when PKCE is enabled (RFC 7636 §4.5)
        if oauth2_client.use_pkce:
            if not code_verifier:
                logger.error(
                    "PKCE enabled but code_verifier cookie missing for IDP %s. "
                    "This may indicate a cookie issue, CORS misconfiguration, or "
                    "browser compatibility problem.",
                    idp_name,
                )
                return _redirect_to_login(request=request, error="auth_failed")
            fetch_kwargs["code_verifier"] = code_verifier
        token_data = await oauth2_client.fetch_access_token(**fetch_kwargs)
    except OAuthError as e:
        logger.error("OAuth2 error for IDP %s: %s", idp_name, e)
        return _redirect_to_login(request=request, error="oauth_error")
    _validate_token_data(token_data)
    if "id_token" not in token_data:
        logger.error("OAuth2 IDP %s does not appear to support OpenID Connect", idp_name)
        return _redirect_to_login(request=request, error="no_oidc_support")

    try:
        id_token_claims = await oauth2_client.parse_id_token(token_data, nonce=stored_nonce)
    except JoseError as e:
        logger.error("ID token validation failed for IDP %s: %s", idp_name, e)
        return _redirect_to_login(request=request, error="auth_failed")

    if oauth2_client.has_sufficient_claims(id_token_claims):
        user_claims = id_token_claims
    else:
        user_claims = await _fetch_and_merge_userinfo_claims(
            oauth2_client, token_data, id_token_claims
        )

    try:
        user_info = _parse_user_info(user_claims)
    except (MissingEmailScope, InvalidUserInfo) as e:
        logger.error("Error parsing user info for IDP %s: %s", idp_name, e)
        return _redirect_to_login(request=request, error="missing_email_scope")

    # Validate access and extract role from claims
    # Both validate_access and extract_and_map_role may raise PermissionError
    try:
        oauth2_client.validate_access(user_info.claims)
        # Extract and map role from claims
        # Returns None if role mapping not configured (preserves existing user roles)
        # Raises PermissionError if strict mode enabled and role validation fails
        role_name = oauth2_client.extract_and_map_role(user_info.claims)
    except PermissionError as e:
        logger.error("Access validation failed for IDP %s: %s", idp_name, e)
        return _redirect_to_login(request=request, error="auth_failed")

    try:
        async with request.app.state.db() as session:
            user = await _process_oauth2_user(
                session,
                oauth2_client_id=str(oauth2_client.client_id),
                user_info=user_info,
                allow_sign_up=oauth2_client.allow_sign_up,
                role_name=role_name,
            )
    except EmailAlreadyInUse as e:
        logger.error("Email already in use for IDP %s: %s", idp_name, e)
        return _redirect_to_login(request=request, error="email_in_use")
    except SignInNotAllowed as e:
        logger.error("Sign in not allowed for IDP %s: %s", idp_name, e)
        return _redirect_to_login(request=request, error="sign_in_not_allowed")
    access_token, refresh_token = await create_access_and_refresh_tokens(
        user=user,
        token_store=token_store,
        access_token_expiry=access_token_expiry,
        refresh_token_expiry=refresh_token_expiry,
    )
    redirect_path = prepend_root_path(request.scope, return_url or "/")
    response = RedirectResponse(
        url=redirect_path,
        status_code=302,
    )
    response = set_access_token_cookie(
        response=response, access_token=access_token, max_age=access_token_expiry
    )
    response = set_refresh_token_cookie(
        response=response, refresh_token=refresh_token, max_age=refresh_token_expiry
    )
    response = delete_oauth2_state_cookie(response)
    response = delete_oauth2_nonce_cookie(response)
    response = delete_oauth2_code_verifier_cookie(response)
    return response


@dataclass(frozen=True)
class UserInfo:
    idp_user_id: str
    email: str
    username: Optional[str] = None
    profile_picture_url: Optional[str] = None
    claims: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not (idp_user_id := (self.idp_user_id or "").strip()):
            raise ValueError("idp_user_id cannot be empty")
        object.__setattr__(self, "idp_user_id", idp_user_id)
        if not (email := sanitize_email(self.email or "")):
            raise ValueError("email cannot be empty")
        object.__setattr__(self, "email", email)
        if username := (self.username or "").strip():
            object.__setattr__(self, "username", username)
        if profile_picture_url := (self.profile_picture_url or "").strip():
            object.__setattr__(self, "profile_picture_url", profile_picture_url)


async def _fetch_and_merge_userinfo_claims(
    oauth2_client: OAuth2Client,
    token_data: dict[str, Any],
    id_token_claims: dict[str, Any],
) -> dict[str, Any]:
    """
    Fetch claims from UserInfo endpoint and merge with ID token claims.

    Why this is necessary (OIDC Core §5.4, §5.5):
    When claims are requested via scopes (e.g., "profile", "email"), OIDC Core §5.4
    specifies which claims are "REQUESTED" but does not mandate WHERE they must be
    returned. Similarly, §5.5 allows requesting specific claims via the "claims"
    parameter, but providers have discretion on whether to return them in the ID token
    or UserInfo response. In practice, providers often return certain claims (especially
    large ones like groups) only via UserInfo to keep ID tokens compact.

    The UserInfo endpoint (OIDC Core §5.3) provides additional claims beyond what's
    in the ID token, such as group memberships or custom attributes. This function:

    1. Calls the UserInfo endpoint using the access token (OIDC Core §5.3.1, RFC 6750)
    2. Merges userinfo claims with ID token claims
    3. ID token claims override userinfo claims when both contain the same claim

    Why ID token takes precedence (OIDC Core §5.3.2):
    - ID tokens are signed JWTs that have been cryptographically verified
    - UserInfo responses may be unsigned
    - Signed claims are the authoritative source when present in both

    Fallback behavior:
    If the UserInfo request fails, returns only ID token claims. The returned claims
    may be incomplete (missing email or groups), but subsequent validation will catch this:
    - Missing email: _parse_user_info() raises MissingEmailScope
    - Missing groups: validate_access() raises PermissionError if access is denied

    Args:
        oauth2_client: The OAuth2 client to use for fetching userinfo
        token_data: Token response containing the access token (RFC 6749 §5.1)
        id_token_claims: Claims from the verified ID token (OIDC Core §3.1.3.3)

    Returns:
        Merged claims dictionary with ID token claims overriding userinfo claims
    """
    try:
        # OIDC Core §5.3.1: UserInfo request authenticated with access token
        userinfo_claims = await oauth2_client.userinfo(token=token_data)
        # ID token claims take precedence (signed and verified)
        return {**userinfo_claims, **id_token_claims}
    except Exception:
        # Fallback: ID token has essential claims for authentication
        return id_token_claims


def _validate_token_data(token_data: dict[str, Any]) -> None:
    """
    Performs basic validations on the token data returned by the IDP.

    RFC 6749 §5.1: Successful response must include access_token and token_type.
    RFC 6750 §1.1: Bearer token type for HTTP authentication.
    """
    assert isinstance(token_data.get("access_token"), str)
    assert isinstance(token_type := token_data.get("token_type"), str)
    assert token_type.lower() == "bearer"


def _parse_user_info(user_info: dict[str, Any]) -> UserInfo:
    """
    Parses user info from the IDP's ID token.

    Validates required OIDC claims and extracts user information according to the
    OpenID Connect Core 1.0 specification.

    Args:
        user_info: Claims from the ID token (validated JWT payload)

    Returns:
        UserInfo object with validated user data

    Raises:
        InvalidUserInfo: If required claims are missing or malformed
        MissingEmailScope: If email claim is missing or invalid

    ID Token Required Claims (OIDC Core §2, §3.1.3.3):
        - iss (issuer): Identifier for the OpenID Provider
        - sub (subject): Unique identifier for the End-User at the Issuer
        - aud (audience): Client ID this ID token is intended for
        - exp (expiration): Expiration time
        - iat (issued at): Time the JWT was issued
        - nonce (if sent in auth request): Value sent in the Authentication Request

    Application-Required Claims:
        - email: Required by this application for user identification

    Optional Standard Claims (OIDC Core §5.1):
        - name: Full name
        - picture: Profile picture URL
        - Other profile, email, address, and phone claims

    Note: While iss, sub, aud, exp, iat are REQUIRED in all ID tokens per spec,
    other claims like email, name, groups are optional and may appear in the ID token,
    UserInfo response, or both depending on what was requested and provider implementation.
    """
    # Validate 'sub' claim (OIDC required, MUST be a string per spec)
    subject = user_info.get("sub")
    if subject is None:
        raise InvalidUserInfo(
            "Missing required 'sub' claim in ID token. "
            "Please check your OIDC provider configuration."
        )

    # OIDC spec: sub MUST be a string, but some IDPs send integers
    # Convert to string for compatibility
    if isinstance(subject, (str, int)):
        idp_user_id = str(subject).strip()
    else:
        raise InvalidUserInfo(
            f"Invalid 'sub' claim type: {type(subject).__name__}. Expected string or integer."
        )

    if not idp_user_id:
        raise InvalidUserInfo("The 'sub' claim cannot be empty.")

    # Validate 'email' claim (application requirement)
    email = user_info.get("email")
    if not isinstance(email, str) or not email.strip():
        raise MissingEmailScope(
            "Missing or invalid 'email' claim. "
            "Please ensure your OIDC provider is configured to include the 'email' scope."
        )
    email = email.strip()

    # Optional: 'name' claim (Full name)
    username = user_info.get("name")
    if username is not None:
        if not isinstance(username, str):
            # Some IDPs might send unexpected types; ignore gracefully
            username = None
        else:
            username = username.strip() or None

    # Optional: 'picture' claim (Profile picture URL)
    profile_picture_url = user_info.get("picture")
    if profile_picture_url is not None:
        if not isinstance(profile_picture_url, str):
            # Some IDPs might send unexpected types; ignore gracefully
            profile_picture_url = None
        else:
            profile_picture_url = profile_picture_url.strip() or None

    # Keep only non-empty claim values for downstream processing
    def _has_value(v: Any) -> bool:
        """Check if a claim value is considered non-empty."""
        if v is None:
            return False
        if isinstance(v, str):
            return bool(v.strip())
        if isinstance(v, (list, dict, set, tuple)):
            return len(v) > 0
        # Include all other types (numbers, booleans, etc.)
        return True

    filtered_claims = {k: v for k, v in user_info.items() if _has_value(v)}

    return UserInfo(
        idp_user_id=idp_user_id,
        email=email,
        username=username,
        profile_picture_url=profile_picture_url,
        claims=filtered_claims,
    )


async def _process_oauth2_user(
    session: AsyncSession,
    /,
    *,
    oauth2_client_id: str,
    user_info: UserInfo,
    allow_sign_up: bool,
    role_name: Optional[OAuth2UserRoleName],
) -> models.User:
    """
    Processes an OAuth2 user, either signing in an existing user or creating/updating one.

    This function handles two main scenarios based on the allow_sign_up parameter:
    1. When sign-up is not allowed (allow_sign_up=False):
       - Checks if the user exists and can sign in with the given OAuth2 credentials
       - Updates placeholder OAuth2 credentials if needed (e.g., temporary IDs)
       - Updates the user's role if role_name is provided (role mapping configured)
       - If the user doesn't exist or has a password set, raises SignInNotAllowed
    2. When sign-up is allowed (allow_sign_up=True):
       - Finds the user by OAuth2 credentials (client_id and user_id)
       - Creates a new user if one doesn't exist, with the provided role (or VIEWER if None)
       - Updates the user's email and role (if role_name provided) if they have changed
       - Handles username conflicts by adding a random suffix if needed

    The allow_sign_up parameter is typically controlled by the PHOENIX_OAUTH2_{IDP_NAME}_ALLOW_SIGN_UP
    environment variable for the specific identity provider.

    Args:
        session: The database session
        oauth2_client_id: The ID of the OAuth2 client
        user_info: User information from the OAuth2 provider
        allow_sign_up: Whether to allow creating new users
        role_name: The Phoenix role name to assign (ADMIN, MEMBER, VIEWER), or None to preserve
                   existing user roles (backward compatibility when role mapping not configured)

    Returns:
        The user object

    Raises:
        SignInNotAllowed: When sign-in is not allowed for the user (user doesn't exist or has a password)
        EmailAlreadyInUse: When the email is already in use by another account
    """  # noqa: E501
    if not allow_sign_up:
        return await _sign_in_existing_oauth2_user(
            session,
            oauth2_client_id=oauth2_client_id,
            user_info=user_info,
            role_name=role_name,
        )
    return await _create_or_update_user(
        session,
        oauth2_client_id=oauth2_client_id,
        user_info=user_info,
        role_name=role_name,
    )


async def _sign_in_existing_oauth2_user(
    session: AsyncSession,
    /,
    *,
    oauth2_client_id: str,
    user_info: UserInfo,
    role_name: Optional[OAuth2UserRoleName],
) -> models.User:
    """Signs in an existing user with OAuth2 credentials.

    This function handles OAuth2 authentication for existing users. It follows a two-step process:

    1. First Attempt: Find user by OAuth2 credentials
       - Searches for a user with matching oauth2_client_id and oauth2_user_id
       - If found, updates email if it has changed from IDP info
       - If not found, proceeds to step 2

    2. Second Attempt: Find user by email
       - Searches for a user with matching email
       - Verifies the user is an OAuth2 user (no password set)
       - Handles OAuth2 credential updates in three cases:
         a) Different OAuth2 client: Updates both client and user IDs
         b) Same client but missing user ID: Sets the user ID
         c) Same client but different user ID: Rejects sign-in

    Profile Updates:
    - Email: Updated if different from IDP info
    - Profile Picture: Updated if provided in user_info
    - Role: Updated ONLY if role_name is provided (role mapping configured)
    - Username: Never updated (remains unchanged)
    - OAuth2 Credentials: Updated based on the three cases above

    Args:
        session: The database session
        oauth2_client_id: The ID of the OAuth2 client
        user_info: User information from the OAuth2 provider
        role_name: The Phoenix role name to assign (ADMIN, MEMBER, VIEWER), or None to preserve
                   existing role (backward compatibility when role mapping not configured)

    Returns:
        The signed-in user

    Raises:
        ValueError: If required fields (email, oauth2_user_id, oauth2_client_id) are empty
        SignInNotAllowed: When sign-in is not allowed because:
            - User doesn't exist
            - User has a password set
            - User has mismatched OAuth2 credentials
    """  # noqa: E501
    if not (email := sanitize_email(user_info.email or "")):
        raise ValueError("Email is required.")
    if not (oauth2_user_id := (user_info.idp_user_id or "").strip()):
        raise ValueError("OAuth2 user ID is required.")
    if not (oauth2_client_id := (oauth2_client_id or "").strip()):
        raise ValueError("OAuth2 client ID is required.")
    profile_picture_url = (user_info.profile_picture_url or "").strip()
    stmt = select(models.User).options(joinedload(models.User.role))
    if user := await session.scalar(
        stmt.filter_by(oauth2_client_id=oauth2_client_id, oauth2_user_id=oauth2_user_id)
    ):
        if email and email != user.email:
            user.email = email
    else:
        user = await session.scalar(stmt.where(func.lower(models.User.email) == email))
        if user is None or not isinstance(user, models.OAuth2User):
            raise SignInNotAllowed("Sign in is not allowed.")
        # Case 1: Different OAuth2 client - update both client and user IDs
        if oauth2_client_id != user.oauth2_client_id:
            user.oauth2_client_id = oauth2_client_id
            user.oauth2_user_id = oauth2_user_id
        # Case 2: Same client but missing user ID - set the user ID
        elif not user.oauth2_user_id:
            user.oauth2_user_id = oauth2_user_id
        # Case 3: Same client but different user ID - reject sign-in
        elif oauth2_user_id != user.oauth2_user_id:
            raise SignInNotAllowed("Sign in is not allowed.")
    if profile_picture_url != user.profile_picture_url:
        user.profile_picture_url = profile_picture_url

    # Update role ONLY if role mapping is configured (role_name is not None)
    # This preserves existing user roles when role mapping is not configured
    if role_name is not None and user.role.name != role_name:
        role = await session.scalar(
            select(models.UserRole).where(models.UserRole.name == role_name)
        )
        if role is not None:
            user.role = role

    if user in session.dirty:
        await session.flush()
    return user


async def _create_or_update_user(
    session: AsyncSession,
    /,
    *,
    oauth2_client_id: str,
    user_info: UserInfo,
    role_name: Optional[OAuth2UserRoleName],
) -> models.User:
    """
    Creates a new user or updates an existing one with OAuth2 credentials.

    Args:
        session: The database session
        oauth2_client_id: The ID of the OAuth2 client
        user_info: User information from the OAuth2 provider
        role_name: The Phoenix role name to assign (ADMIN, MEMBER, VIEWER), or None to use
                   VIEWER for new users and preserve existing users' roles (backward compatibility)

    Returns:
        The created or updated user

    Raises:
        EmailAlreadyInUse: When the email is already in use by another account
    """
    user = await _get_user(
        session,
        oauth2_client_id=oauth2_client_id,
        idp_user_id=user_info.idp_user_id,
    )
    if user is None:
        # New user: use provided role_name, or default to VIEWER if role mapping not configured
        user = await _create_user(
            session,
            oauth2_client_id=oauth2_client_id,
            user_info=user_info,
            role_name=role_name or "VIEWER",  # Default for new users
        )
    else:
        # Existing user: update email, profile picture, and/or role if changed
        if user.email != user_info.email:
            user.email = user_info.email

        # Update profile picture if changed
        if user.profile_picture_url != user_info.profile_picture_url:
            user.profile_picture_url = user_info.profile_picture_url

        # Update role ONLY if role mapping is configured (role_name is not None)
        # This preserves existing user roles when role mapping is not configured
        if role_name is not None and user.role.name != role_name:
            role = await session.scalar(
                select(models.UserRole).where(models.UserRole.name == role_name)
            )
            if role is not None:
                user.role = role

        # Flush to execute the UPDATE and catch any email conflicts
        if user in session.dirty:
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise EmailAlreadyInUse(f"An account for {user_info.email} is already in use.")
    return user


async def _get_user(
    session: AsyncSession,
    /,
    *,
    oauth2_client_id: str,
    idp_user_id: str,
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
    role_name: OAuth2UserRoleName,
) -> models.User:
    """
    Creates a new user with the user info from the IDP.

    Args:
        session: The database session
        oauth2_client_id: The ID of the OAuth2 client
        user_info: User information from the OAuth2 provider
        role_name: The Phoenix role name to assign (ADMIN, MEMBER, VIEWER)

    Returns:
        The created user
    """
    email_exists, username_exists = await _email_and_username_exist(
        session,
        email=(email := user_info.email),
        username=(username := user_info.username),
    )
    if email_exists:
        raise EmailAlreadyInUse(f"An account for {email} is already in use.")
    role_id = select(models.UserRole.id).where(models.UserRole.name == role_name).scalar_subquery()
    user_id = await session.scalar(
        insert(models.User)
        .returning(models.User.id)
        .values(
            user_role_id=role_id,
            oauth2_client_id=oauth2_client_id,
            oauth2_user_id=user_info.idp_user_id,
            username=_with_random_suffix(username) if username and username_exists else username,
            email=email,
            profile_picture_url=user_info.profile_picture_url,
            reset_password=False,
            auth_method="OAUTH2",
        )
    )
    assert isinstance(user_id, int)
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
                        func.max(case((func.lower(models.User.email) == email, 1), else_=0)),
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
            ).where(or_(func.lower(models.User.email) == email, models.User.username == username))
        )
    ).all()
    return email_exists, username_exists


class EmailAlreadyInUse(Exception):
    pass


class SignInNotAllowed(Exception):
    pass


class NotInvited(Exception):
    pass


class MissingEmailScope(Exception):
    """
    Raised when the OIDC provider does not return the email scope.
    """

    pass


class InvalidUserInfo(Exception):
    """
    Raised when the OIDC user info is malformed or missing required claims.
    """

    pass


def _redirect_to_login(*, request: Request, error: AuthErrorCode) -> RedirectResponse:
    """
    Creates a RedirectResponse to the login page to display an error code.
    The error code will be validated and mapped to a user-friendly message on the frontend.
    """
    # TODO: this needs some cleanup
    login_path = prepend_root_path(
        request.scope, "/login" if not get_env_disable_basic_auth() else "/logout"
    )
    url = URL(login_path).include_query_params(error=error)
    response = RedirectResponse(url=url)
    response = delete_oauth2_state_cookie(response)
    response = delete_oauth2_nonce_cookie(response)
    response = delete_oauth2_code_verifier_cookie(response)
    return response


def _append_root_path_if_exists(*, request: Request, base_url: str) -> str:
    """
    If a root path is configured, appends it to the input base url.
    """
    if not (root_path := get_root_path(request.scope)):
        return base_url
    return str(URLPath(root_path).make_absolute_url(base_url=base_url))


def _get_create_tokens_endpoint(*, request: Request, origin_url: str, idp_name: str) -> str:
    """
    Gets the endpoint for create tokens route.
    """
    router: Router = request.scope["router"]
    url_path = router.url_path_for(create_tokens.__name__, idp_name=idp_name)
    return str(url_path.make_absolute_url(base_url=origin_url))


def _generate_state_for_oauth2_authorization_code_flow(
    *, secret: Secret, origin_url: str, return_url: Optional[str]
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
    jwt_bytes: bytes = jwt.encode(header=header, payload=payload, key=str(secret))
    return jwt_bytes.decode()


class _OAuth2StatePayload(TypedDict):
    """
    Represents the OAuth2 state payload.
    """

    random: str
    origin_url: str
    return_url: NotRequired[str]


def _parse_state_payload(*, secret: Secret, state: str) -> _OAuth2StatePayload:
    """
    Validates the JWT signature and parses the return URL from the OAuth2 state.
    """
    payload = jwt.decode(s=state, key=str(secret))
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
_RELATIVE_URL_PATTERN = re.compile(r"^/($|\w)")
