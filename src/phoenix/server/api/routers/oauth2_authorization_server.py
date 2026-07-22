"""OAuth2 authorization server: Phoenix issues tokens to clients."""

from __future__ import annotations

import logging
import string
from datetime import datetime, timedelta, timezone
from secrets import choice, token_urlsafe
from typing import Any, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from starlette.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

from phoenix.auth import PHOENIX_ACCESS_TOKEN_COOKIE_NAME, ClaimSetStatus, Token
from phoenix.config import (
    get_env_disable_rate_limit,
    get_env_oauth2_allowed_redirect_hosts,
    get_env_oauth2_consent_origin_check,
    get_env_oauth2_dcr_rate_limit_per_hour,
    get_env_oauth2_dynamic_client_registration,
    get_env_oauth2_grant_expiry,
)
from phoenix.db import models
from phoenix.server.bearer_auth import PhoenixUser, create_access_and_refresh_tokens
from phoenix.server.oauth2_authorization_server import (
    OAuth2AuthorizationServerError,
    RedirectUriDialPosition,
    RedirectUriValidationError,
    ResourceIdentifierError,
    canonical_resource_identifier,
    get_oauth2_client_by_client_id,
    granted_scopes_from_request,
    hash_authorization_code,
    public_origin,
    validate_redirect_uri,
    validate_state,
    verify_pkce,
)
from phoenix.server.rate_limiters import (
    ServerRateLimiter,
    fastapi_ip_rate_limiter,
)
from phoenix.server.types import (
    AccessTokenClaims,
    AccessTokenId,
    RefreshTokenClaims,
    RefreshTokenId,
    TokenStore,
    UserId,
)
from phoenix.server.utils import GET_HEAD, prepend_root_path, strip_root_path

logger = logging.getLogger(__name__)

if get_env_oauth2_consent_origin_check() == "off":
    logger.warning(
        "OAuth2 consent Origin-header validation is disabled by "
        "PHOENIX_OAUTH2_CONSENT_ORIGIN_CHECK=off."
    )

_AUTHORIZATION_CODE_TTL = timedelta(minutes=5)
_TOKEN_TYPE = "Bearer"
_DCR_CLIENT_ID_PREFIX = "px_dcr_"
_DCR_CLIENT_ID_RANDOM_LENGTH = 22
_DCR_CLIENT_NAME_MAX_LENGTH = 200
_DCR_LOGO_URI_MAX_LENGTH = 2048
_DCR_SUPPORTED_GRANT_TYPES = frozenset({"authorization_code", "refresh_token"})
_DCR_SUPPORTED_RESPONSE_TYPES = frozenset({"code"})
_DCR_MAX_UNCONSUMED_PER_IP_PER_DAY = 50
_DCR_ZERO_GRANT_TTL = timedelta(days=7)
_DCR_DEAD_GRANT_TTL = timedelta(days=30)
_BASE62_ALPHABET = string.ascii_letters + string.digits
_OAUTH_NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
}
_last_dcr_cleanup_at: Optional[datetime] = None

_rate_limiter = fastapi_ip_rate_limiter(
    ServerRateLimiter(
        per_second_rate_limit=0.2,
        enforcement_window_seconds=60,
        partition_seconds=60,
        active_partitions=2,
    ),
    paths=["/oauth2/token", "/oauth2/revoke"],
)
_rate_limit_dependencies = [] if get_env_disable_rate_limit() else [Depends(_rate_limiter)]
_dcr_rate_limiter = fastapi_ip_rate_limiter(
    ServerRateLimiter(
        per_second_rate_limit=get_env_oauth2_dcr_rate_limit_per_hour() / 3600,
        enforcement_window_seconds=3600,
        partition_seconds=3600,
        active_partitions=2,
    ),
    paths=["/oauth2/register"],
)
_dcr_rate_limit_dependencies = [] if get_env_disable_rate_limit() else [Depends(_dcr_rate_limiter)]


async def authorization_server_enabled(request: Request) -> None:
    """Router-level guard behind PHOENIX_ENABLE_OAUTH2_AUTHORIZATION_SERVER.

    Responds 404 rather than skipping router registration: an unregistered path
    would fall through to the SPA catch-all and answer with index.html and a 200,
    so a disabled deployment would still look like it serves these endpoints. A
    real 404 is also the signal the CLI already maps to "this server does not
    support OAuth login".
    """
    if not getattr(request.app.state, "oauth2_authorization_server_enabled", True):
        raise HTTPException(
            status_code=404,
            detail="The OAuth2 authorization server is disabled on this deployment.",
        )


router = APIRouter(
    include_in_schema=False,
    dependencies=[Depends(authorization_server_enabled)],
)
oauth2_router = APIRouter(
    prefix="/oauth2",
    include_in_schema=False,
    dependencies=[Depends(authorization_server_enabled)],
)


class AuthorizationDecision(BaseModel):
    client_id: str
    redirect_uri: str
    state: str
    code_challenge: str
    code_challenge_method: str
    response_type: str
    resource: Optional[str] = None
    scope: Optional[str] = None
    approved: bool


class DynamicClientRegistrationRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    client_name: Optional[str] = Field(default=None, max_length=_DCR_CLIENT_NAME_MAX_LENGTH)
    redirect_uris: list[str] = Field(min_length=1)
    grant_types: list[str] = Field(default_factory=lambda: ["authorization_code", "refresh_token"])
    response_types: list[str] = Field(default_factory=lambda: ["code"])
    token_endpoint_auth_method: Optional[str] = None
    logo_uri: Optional[str] = Field(default=None, max_length=_DCR_LOGO_URI_MAX_LENGTH)

    @field_validator("client_name")
    @classmethod
    def client_name_is_printable(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value or not value.isprintable():
            raise ValueError("client_name must contain printable characters.")
        return value

    @field_validator("grant_types")
    @classmethod
    def grant_types_are_supported(cls, value: list[str]) -> list[str]:
        if not value or any(grant_type not in _DCR_SUPPORTED_GRANT_TYPES for grant_type in value):
            raise ValueError("grant_types contains unsupported values.")
        return value

    @field_validator("response_types")
    @classmethod
    def response_types_are_supported(cls, value: list[str]) -> list[str]:
        if not value or any(
            response_type not in _DCR_SUPPORTED_RESPONSE_TYPES for response_type in value
        ):
            raise ValueError("response_types contains unsupported values.")
        return value

    @property
    def metadata(self) -> dict[str, object]:
        return dict(self.model_extra or {})


@oauth2_router.get("/authorize")
async def authorize(request: Request) -> Response:
    if _get_cookie_user(request) is None:
        return _redirect_to_login(request)
    redirect_uri = request.query_params.get("redirect_uri")
    client_id = request.query_params.get("client_id")
    async with request.app.state.db() as session:
        client = (
            await get_oauth2_client_by_client_id(session, client_id)
            if client_id is not None
            else None
        )
    if client is None:
        return _html_error("Unknown OAuth2 client.")
    if redirect_uri is None:
        return _html_error("Missing redirect URI.")
    try:
        validate_redirect_uri(
            redirect_uri,
            client.redirect_uris,
            _redirect_uri_dial_position(),
        )
    except RedirectUriValidationError:
        return _html_error("Invalid redirect URI.")
    error = _authorization_request_error(
        request=request,
        client=client,
        redirect_uri=redirect_uri,
    )
    state = request.query_params.get("state")
    if error is not None:
        return _redirect_with_oauth_error(redirect_uri, error=error, state=state)
    path = prepend_root_path(request.scope, "/oauth2/consent")
    query = [
        (key, value)
        for key, value in parse_qsl(request.url.query, keep_blank_values=True)
        if key not in {"client_name", "is_first_party"}
    ]
    query.extend(
        [
            ("client_name", client.name),
            ("is_first_party", "true" if client.is_first_party else "false"),
        ]
    )
    url = f"{path}?{urlencode(query)}"
    return RedirectResponse(url=url, status_code=302)


@oauth2_router.post("/authorize/decision")
async def authorize_decision(request: Request, decision: AuthorizationDecision) -> JSONResponse:
    user = _get_cookie_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    _validate_consent_origin(request)
    async with request.app.state.db() as session:
        client = await get_oauth2_client_by_client_id(session, decision.client_id)
        if client is None:
            raise HTTPException(status_code=400, detail="Unknown OAuth2 client")
        try:
            validate_redirect_uri(
                decision.redirect_uri,
                client.redirect_uris,
                _redirect_uri_dial_position(),
            )
        except RedirectUriValidationError as validation_error:
            raise HTTPException(
                status_code=400, detail="Invalid redirect URI"
            ) from validation_error
        request_error = _authorization_decision_error(
            request=request, client=client, decision=decision
        )
        if request_error is not None:
            return _oauth_json_response(
                {
                    "redirect_to": _with_query_params(
                        decision.redirect_uri,
                        error=request_error,
                        state=decision.state,
                    )
                }
            )
        if not decision.approved:
            return _oauth_json_response(
                {
                    "redirect_to": _with_query_params(
                        decision.redirect_uri,
                        error="access_denied",
                        state=decision.state,
                    )
                }
            )
        raw_code = token_urlsafe(32)
        now = datetime.now(timezone.utc)
        session.add(
            models.OAuth2AuthorizationCode(
                code_hash=hash_authorization_code(raw_code),
                user_id=int(user.identity),
                oauth2_client_id=client.id,
                redirect_uri=decision.redirect_uri,
                code_challenge=decision.code_challenge,
                code_challenge_method=decision.code_challenge_method,
                scopes=list(granted_scopes_from_request(decision.scope)) or None,
                # `resource` preserves the indicator as the client sent it (RFC 8707);
                # `audience` is its canonical form, carried through the grant onto the
                # minted tokens so each token records which resource it was issued for.
                resource=decision.resource or None,
                audience=_granted_audience(decision.resource),
                expires_at=now + _AUTHORIZATION_CODE_TTL,
            )
        )
    return _oauth_json_response(
        {
            "redirect_to": _with_query_params(
                decision.redirect_uri,
                code=raw_code,
                state=decision.state,
            )
        }
    )


@oauth2_router.post("/token", dependencies=_rate_limit_dependencies)
async def token(request: Request) -> JSONResponse:
    form = await request.form()
    grant_type = _form_str(form, "grant_type")
    if grant_type == "authorization_code":
        return await _exchange_authorization_code(request, form)
    if grant_type == "refresh_token":
        return await _exchange_refresh_token(request, form)
    return _oauth_error("unsupported_grant_type")


@oauth2_router.post("/revoke", dependencies=_rate_limit_dependencies)
async def revoke(request: Request) -> Response:
    """Revoke a token; revoking any token ends the entire session."""
    form = await request.form()
    raw_token = _form_str(form, "token")
    if raw_token is None:
        return Response(status_code=200)
    token_store: TokenStore = request.app.state.get_token_store()
    claims = await token_store.read(Token(raw_token))
    if isinstance(claims, AccessTokenClaims) and claims.token_id is not None:
        await _revoke_access_token(request, claims)
    elif isinstance(claims, RefreshTokenClaims) and claims.token_id is not None:
        await _revoke_refresh_token(request, claims)
    return Response(status_code=200)


@oauth2_router.post("/register", dependencies=_dcr_rate_limit_dependencies)
async def register(request: Request) -> JSONResponse:
    dial_position = _dcr_policy()
    if dial_position == RedirectUriDialPosition.DISABLED:
        return _dcr_error(
            "invalid_client_metadata",
            "Dynamic client registration is disabled.",
            status_code=403,
        )
    try:
        registration = DynamicClientRegistrationRequest.model_validate_json(await request.body())
    except ValidationError:
        return _dcr_error("invalid_client_metadata", "Invalid client metadata.")
    redirect_error = _validate_dcr_redirect_uris(registration.redirect_uris, dial_position)
    if redirect_error is not None:
        return redirect_error
    client_ip = _client_ip(request)
    now = datetime.now(timezone.utc)
    async with request.app.state.db() as session:
        await _cleanup_abandoned_dcr_clients(session, now=now)
        if client_ip is not None and await _has_too_many_unconsumed_dcr_clients(
            session,
            client_ip=client_ip,
            now=now,
        ):
            raise HTTPException(status_code=429, detail="Too Many Requests")
        client_id = await _new_dcr_client_id(session)
        metadata = registration.metadata
        session.add(
            models.OAuth2Client(
                client_id=client_id,
                name=registration.client_name or "OAuth2 client",
                logo_uri=registration.logo_uri,
                redirect_uris=registration.redirect_uris,
                grant_types=registration.grant_types,
                token_endpoint_auth_method="none",
                is_first_party=False,
                # metadata_ holds only the client's own unrecognized fields, none of which
                # are validated. The observed address goes in its own column so a request
                # body cannot pass off a forged value as something the server saw.
                metadata_=metadata or None,
                registration_client_ip=client_ip,
            )
        )
    return _oauth_json_response(
        {
            "client_id": client_id,
            "client_name": registration.client_name,
            "redirect_uris": registration.redirect_uris,
            "grant_types": registration.grant_types,
            "response_types": registration.response_types,
            "token_endpoint_auth_method": "none",
            **({"logo_uri": registration.logo_uri} if registration.logo_uri else {}),
        },
        status_code=201,
    )


def _authorization_server_metadata(request: Request) -> dict[str, Any]:
    issuer = public_origin(request)
    metadata: dict[str, Any] = {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/oauth2/authorize",
        "token_endpoint": f"{issuer}/oauth2/token",
        "revocation_endpoint": f"{issuer}/oauth2/revoke",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
    }
    if _dcr_policy() != RedirectUriDialPosition.DISABLED:
        metadata["registration_endpoint"] = f"{issuer}/oauth2/register"
    return metadata


@router.api_route("/.well-known/oauth-authorization-server", methods=GET_HEAD)
async def authorization_server_metadata(request: Request) -> JSONResponse:
    return JSONResponse(_authorization_server_metadata(request))


@router.api_route("/.well-known/openid-configuration", methods=GET_HEAD)
async def openid_configuration(request: Request) -> JSONResponse:
    """Serve the authorization-server metadata at the OIDC discovery location.

    When the deployment runs under a root path, the issuer has a path component,
    and RFC 8414 puts the well-known segment between host and path — a URL the
    reverse proxy in front of Phoenix typically does not route to Phoenix at all.
    The discovery order MCP clients follow (RFC 8414 path-inserted, then OIDC
    path-inserted, then OIDC path-appended) never requests the path-appended
    ``oauth-authorization-server`` form Phoenix serves above, so this
    path-appended OIDC location is the one fallback such clients can reach
    without proxy configuration. Phoenix is not an OpenID provider; the document
    carries the same OAuth fields as the RFC 8414 one, which is what MCP clients
    consume from it.
    """
    return JSONResponse(_authorization_server_metadata(request))


async def _exchange_authorization_code(request: Request, form: Any) -> JSONResponse:
    code = _form_str(form, "code")
    client_id = _form_str(form, "client_id")
    redirect_uri = _form_str(form, "redirect_uri")
    code_verifier = _form_str(form, "code_verifier")
    resource = _form_str(form, "resource")
    if not code or not client_id or not redirect_uri or not code_verifier:
        return _oauth_error("invalid_grant")
    if _resource_mismatch(request, resource):
        return _oauth_error("invalid_target")
    code_hash = hash_authorization_code(code)
    now = datetime.now(timezone.utc)
    async with request.app.state.db() as session:
        # A code is single-use: concurrent redemptions must not both mint a grant.
        # The conditional DELETE ... RETURNING below is the authority — the loser's
        # delete matches zero rows and returns invalid_grant before any grant is
        # created. The row lock here makes the loser block early (skipping wasted
        # PKCE work) rather than racing to that delete. SQLite has no row locks, so
        # an immediate write transaction stands in for FOR UPDATE; it must be the
        # first statement in this session, before any implicit read transaction opens.
        if session.bind is not None and session.bind.dialect.name == "sqlite":
            await session.execute(sa.text("BEGIN IMMEDIATE"))
        authorization_code = await session.scalar(
            sa.select(models.OAuth2AuthorizationCode)
            .where(models.OAuth2AuthorizationCode.code_hash == code_hash)
            .with_for_update(of=models.OAuth2AuthorizationCode)
            .options(
                joinedload(models.OAuth2AuthorizationCode.client),
                joinedload(models.OAuth2AuthorizationCode.user).joinedload(models.User.role),
            )
        )
        if authorization_code is None:
            return _oauth_error("invalid_grant")
        if authorization_code.expires_at <= now:
            await session.delete(authorization_code)
            return _oauth_error("invalid_grant")
        if authorization_code.client.client_id != client_id:
            return _oauth_error("invalid_grant")
        if authorization_code.redirect_uri != redirect_uri:
            return _oauth_error("invalid_grant")
        if not verify_pkce(code_verifier, authorization_code.code_challenge):
            return _oauth_error("invalid_grant")
        # RFC 8707: the token request may repeat the resource indicator, but it
        # cannot re-target the code — the audience was fixed at authorization, and
        # a code authorized for no resource must not mint tokens labeled for one.
        # MCP clients send the indicator on both requests, so a repeat matches.
        requested_audience = _granted_audience(resource)
        granted_audience = authorization_code.audience
        if requested_audience is not None and requested_audience != granted_audience:
            return _oauth_error("invalid_target")
        audience = granted_audience
        claimed_code_id = await session.scalar(
            sa.delete(models.OAuth2AuthorizationCode)
            .where(models.OAuth2AuthorizationCode.id == authorization_code.id)
            .returning(models.OAuth2AuthorizationCode.id)
            .execution_options(synchronize_session=False)
        )
        if claimed_code_id is None:
            return _oauth_error("invalid_grant")
        user = authorization_code.user
        scopes = tuple(authorization_code.scopes or ())
        grant = models.OAuth2Grant(
            user_id=authorization_code.user_id,
            oauth2_client_id=authorization_code.oauth2_client_id,
            scopes=list(scopes),
            audience=audience,
            expires_at=now + get_env_oauth2_grant_expiry(),
            last_used_at=now,
            revoked_at=None,
        )
        session.add(grant)
        await session.flush()
        grant_id = grant.id
    access_token_expiry = _access_token_expiry(request, grant_expires_at=grant.expires_at)
    refresh_token_expiry = _refresh_token_expiry(request, grant_expires_at=grant.expires_at)
    token_store: TokenStore = request.app.state.get_token_store()
    access_token, refresh_token = await create_access_and_refresh_tokens(
        token_store=token_store,
        user=user,
        access_token_expiry=access_token_expiry,
        refresh_token_expiry=refresh_token_expiry,
        grant_id=grant_id,
        scopes=scopes,
        audience=tuple(audience) if audience is not None else None,
    )
    return _token_response(access_token, refresh_token, access_token_expiry)


async def _exchange_refresh_token(request: Request, form: Any) -> JSONResponse:
    raw_refresh_token = _form_str(form, "refresh_token")
    client_id = _form_str(form, "client_id")
    resource = _form_str(form, "resource")
    if not raw_refresh_token or not client_id:
        return _oauth_error("invalid_grant")
    if _resource_mismatch(request, resource):
        return _oauth_error("invalid_target")
    token_store: TokenStore = request.app.state.get_token_store()
    refresh_claims = await token_store.read(Token(raw_refresh_token))
    if (
        not isinstance(refresh_claims, RefreshTokenClaims)
        or refresh_claims.token_id is None
        or not isinstance(refresh_claims.subject, UserId)
        or refresh_claims.attributes is None
        or refresh_claims.attributes.grant_id is None
        or refresh_claims.attributes.scopes is None
        or refresh_claims.status is not ClaimSetStatus.VALID
    ):
        await _revoke_grant_on_refresh_replay(request, raw_refresh_token)
        return _oauth_error("invalid_grant")
    now = datetime.now(timezone.utc)
    async with request.app.state.db() as session:
        grant = await session.scalar(
            sa.select(models.OAuth2Grant)
            .where(models.OAuth2Grant.id == refresh_claims.attributes.grant_id)
            .options(
                joinedload(models.OAuth2Grant.client),
                joinedload(models.OAuth2Grant.user).joinedload(models.User.role),
            )
        )
        if (
            grant is None
            or grant.revoked_at is not None
            or (grant.expires_at is not None and grant.expires_at <= now)
            or grant.client.client_id != client_id
        ):
            return _oauth_error("invalid_grant")
        # A refresh cannot re-target the grant: if the request names a resource, it
        # must be the one the grant was authorized for — a null-audience grant
        # admits none. Grants are immutable, so a refresh never adds an audience
        # the authorization did not carry.
        requested_audience = _granted_audience(resource)
        grant_audience = grant.audience
        if requested_audience is not None and requested_audience != grant_audience:
            return _oauth_error("invalid_target")
        user = grant.user
        grant.last_used_at = now
        await session.flush()
        access_token_ids = await session.scalars(
            sa.select(models.AccessToken.id).where(
                models.AccessToken.refresh_token_id == int(refresh_claims.token_id)
            )
        )
        token_ids = [AccessTokenId(id_) for id_ in access_token_ids]
    refresh_token_expiry = _refresh_token_expiry(request, grant_expires_at=grant.expires_at)
    access_token_expiry = _access_token_expiry(request, grant_expires_at=grant.expires_at)
    if not await token_store.consume_refresh_token(refresh_claims.token_id):
        return _oauth_error("invalid_grant")
    await token_store.revoke(*token_ids)
    access_token, refresh_token = await create_access_and_refresh_tokens(
        token_store=token_store,
        user=user,
        access_token_expiry=access_token_expiry,
        refresh_token_expiry=refresh_token_expiry,
        grant_id=grant.id,
        scopes=tuple(refresh_claims.attributes.scopes),
        audience=tuple(grant_audience) if grant_audience is not None else None,
    )
    return _token_response(access_token, refresh_token, access_token_expiry)


def _validate_dcr_redirect_uris(
    redirect_uris: list[str],
    dial_position: RedirectUriDialPosition,
) -> Optional[JSONResponse]:
    for redirect_uri in redirect_uris:
        try:
            redirect = validate_redirect_uri(redirect_uri, [redirect_uri], dial_position)
        except OAuth2AuthorizationServerError:
            return _dcr_error(
                "invalid_redirect_uri",
                "Redirect URI is not allowed while dynamic client registration is "
                f"{dial_position.value}.",
            )
        if redirect.kind == "https_registered":
            allowed_hosts = get_env_oauth2_allowed_redirect_hosts()
            if (
                allowed_hosts
                and (urlsplit(redirect_uri).hostname or "").lower() not in allowed_hosts
            ):
                return _dcr_error(
                    "invalid_redirect_uri",
                    "HTTPS redirect URI host is not allowed.",
                )
    return None


async def _new_dcr_client_id(session: AsyncSession) -> str:
    for _ in range(10):
        suffix = "".join(choice(_BASE62_ALPHABET) for _ in range(_DCR_CLIENT_ID_RANDOM_LENGTH))
        client_id = f"{_DCR_CLIENT_ID_PREFIX}{suffix}"
        if await get_oauth2_client_by_client_id(session, client_id) is None:
            return client_id
    raise HTTPException(status_code=500, detail="Could not allocate OAuth2 client identifier")


async def _has_too_many_unconsumed_dcr_clients(
    session: AsyncSession,
    *,
    client_ip: str,
    now: datetime,
) -> bool:
    since = now - timedelta(days=1)
    # Counted in the database rather than by loading rows: this runs on every registration,
    # and registration spam is exactly what inflates the set being counted. Filtering on
    # the indexed registration_client_ip confines the scan to one address's own recent
    # registrations. Only dynamically registered clients carry that column, so it also
    # stands in for the client_id prefix test.
    has_grant = (
        sa.select(models.OAuth2Grant.id)
        .where(models.OAuth2Grant.oauth2_client_id == models.OAuth2Client.id)
        .exists()
    )
    count = await session.scalar(
        sa.select(sa.func.count())
        .select_from(models.OAuth2Client)
        .where(
            models.OAuth2Client.registration_client_ip == client_ip,
            models.OAuth2Client.created_at >= since,
            ~has_grant,
        )
    )
    return (count or 0) >= _DCR_MAX_UNCONSUMED_PER_IP_PER_DAY


async def _cleanup_abandoned_dcr_clients(session: AsyncSession, *, now: datetime) -> None:
    global _last_dcr_cleanup_at
    if _last_dcr_cleanup_at is not None and now - _last_dcr_cleanup_at < timedelta(days=1):
        return
    _last_dcr_cleanup_at = now
    zero_grant_cutoff = now - _DCR_ZERO_GRANT_TTL
    dead_grant_cutoff = now - _DCR_DEAD_GRANT_TTL
    # Narrow to deletion candidates in SQL instead of walking every client ever registered.
    # Neither rule can delete a client that still has a usable grant, and neither can delete
    # one younger than the later of the two cutoffs, since a client is always older than the
    # grants hanging off it. Both conditions are therefore necessary and cheap to test, which
    # leaves roughly the set about to be deleted to load — the clients that survive cleanup
    # are exactly the ones that accumulate, so the unfiltered scan grew without bound.
    has_live_grant = (
        sa.select(models.OAuth2Grant.id)
        .where(
            models.OAuth2Grant.oauth2_client_id == models.OAuth2Client.id,
            models.OAuth2Grant.revoked_at.is_(None),
            sa.or_(
                models.OAuth2Grant.expires_at.is_(None),
                models.OAuth2Grant.expires_at > now,
            ),
        )
        .exists()
    )
    clients = await session.scalars(
        sa.select(models.OAuth2Client)
        .where(
            models.OAuth2Client.client_id.like(f"{_DCR_CLIENT_ID_PREFIX}%"),
            models.OAuth2Client.created_at <= max(zero_grant_cutoff, dead_grant_cutoff),
            ~has_live_grant,
        )
        .options(selectinload(models.OAuth2Client.grants))
    )
    for client in clients:
        if not client.grants:
            if client.created_at <= zero_grant_cutoff:
                await session.delete(client)
            continue
        inactive_grant_times: list[datetime] = []
        for grant in client.grants:
            inactive_at = _inactive_grant_time(grant, now=now)
            if inactive_at is None:
                break
            inactive_grant_times.append(inactive_at)
        else:
            if max(inactive_grant_times) <= dead_grant_cutoff:
                await session.delete(client)


def _inactive_grant_time(grant: models.OAuth2Grant, *, now: datetime) -> Optional[datetime]:
    if grant.revoked_at is not None:
        return grant.revoked_at
    if grant.expires_at is not None and grant.expires_at <= now:
        return grant.expires_at
    return None


def _client_ip(request: Request) -> Optional[str]:
    client = request.client
    return client.host if client is not None else None


def _get_cookie_user(request: Request) -> Optional[PhoenixUser]:
    if not request.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME):
        return None
    user = request.user
    if not isinstance(user, PhoenixUser):
        return None
    if not isinstance(user.claims, AccessTokenClaims):
        return None
    if user.claims.status is not ClaimSetStatus.VALID:
        return None
    return user


def _redirect_to_login(request: Request) -> RedirectResponse:
    """Redirect to the login page with the request preserved as returnUrl.

    The returnUrl must be relative to the application mount point: every
    consumer re-applies the prefix itself (the SPA router prepends its
    basename on navigation, and the identity-provider callback prepends the
    root path before redirecting), so including the root path here would
    double it.
    """
    return_path = strip_root_path(request.scope, request.url.path)
    if request.url.query:
        return_path = f"{return_path}?{request.url.query}"
    login_path = prepend_root_path(request.scope, "/login")
    return RedirectResponse(
        url=f"{login_path}?{urlencode({'returnUrl': return_path})}",
        status_code=302,
    )


def _html_error(message: str) -> HTMLResponse:
    return HTMLResponse(
        f"<!doctype html><title>OAuth2 Error</title><h1>OAuth2 Error</h1><p>{message}</p>",
        status_code=400,
    )


def _authorization_request_error(
    *,
    request: Request,
    client: models.OAuth2Client,
    redirect_uri: str,
) -> Optional[str]:
    try:
        validate_state(request.query_params.get("state"))
    except OAuth2AuthorizationServerError:
        return "invalid_request"
    if request.query_params.get("response_type") != "code":
        return "unsupported_response_type"
    if not request.query_params.get("code_challenge"):
        return "invalid_request"
    if request.query_params.get("code_challenge_method") != "S256":
        return "invalid_request"
    if _resource_mismatch(request, request.query_params.get("resource")):
        return "invalid_target"
    try:
        validate_redirect_uri(redirect_uri, client.redirect_uris, _redirect_uri_dial_position())
    except RedirectUriValidationError:
        return "invalid_request"
    return None


def _authorization_decision_error(
    *,
    request: Request,
    client: models.OAuth2Client,
    decision: AuthorizationDecision,
) -> Optional[str]:
    try:
        validate_state(decision.state)
    except OAuth2AuthorizationServerError:
        return "invalid_request"
    if decision.response_type != "code":
        return "unsupported_response_type"
    if not decision.code_challenge:
        return "invalid_request"
    if decision.code_challenge_method != "S256":
        return "invalid_request"
    if _resource_mismatch(request, decision.resource):
        return "invalid_target"
    try:
        validate_redirect_uri(
            decision.redirect_uri,
            client.redirect_uris,
            _redirect_uri_dial_position(),
        )
    except RedirectUriValidationError:
        return "invalid_request"
    granted_scopes_from_request(decision.scope)
    return None


def _granted_audience(resource: Optional[str]) -> Optional[list[str]]:
    """Canonical audience list for a resource indicator that already passed
    ``_resource_mismatch``; None when the request named no resource."""
    if not resource:
        return None
    return [canonical_resource_identifier(resource)]


def _resource_mismatch(request: Request, resource: Optional[str]) -> bool:
    if not resource:
        return False
    try:
        canonical = canonical_resource_identifier(resource)
    except ResourceIdentifierError:
        return True
    origin = public_origin(request)
    if canonical == origin:
        return False
    # The MCP endpoint is a distinct protected resource under this deployment:
    # spec-following MCP clients send the URL they connect to (RFC 8707 via the
    # MCP authorization spec), e.g. `<origin>/mcp`, so it must validate whenever
    # the mount is enabled (mcp_mount_path is None otherwise).
    mcp_mount_path: Optional[str] = getattr(request.app.state, "mcp_mount_path", None)
    return not (mcp_mount_path and canonical == f"{origin}{mcp_mount_path}")


def _validate_consent_origin(request: Request) -> None:
    if get_env_oauth2_consent_origin_check() == "off":
        return
    origin = request.headers.get("origin")
    if origin is None or not _same_origin(origin, public_origin(request)):
        raise HTTPException(status_code=403, detail="Invalid Origin header")


def _same_origin(origin: str, expected: str) -> bool:
    actual_parts = urlsplit(origin)
    expected_parts = urlsplit(expected)
    return (
        actual_parts.scheme.lower(),
        actual_parts.netloc.lower(),
    ) == (
        expected_parts.scheme.lower(),
        expected_parts.netloc.lower(),
    )


async def _revoke_access_token(request: Request, claims: AccessTokenClaims) -> None:
    assert claims.token_id is not None
    token_ids: list[AccessTokenId | RefreshTokenId] = [claims.token_id]
    grant_id: Optional[int] = None
    if claims.attributes is not None:
        token_ids.append(claims.attributes.refresh_token_id)
        grant_id = claims.attributes.grant_id
    token_store: TokenStore = request.app.state.get_token_store()
    await token_store.revoke(*token_ids)
    if grant_id is not None:
        await _revoke_grant(request, grant_id)


async def _revoke_refresh_token(request: Request, claims: RefreshTokenClaims) -> None:
    assert claims.token_id is not None
    async with request.app.state.db() as session:
        access_token_ids = await session.scalars(
            sa.select(models.AccessToken.id).where(
                models.AccessToken.refresh_token_id == int(claims.token_id)
            )
        )
        grant_id = claims.attributes.grant_id if claims.attributes is not None else None
    token_store: TokenStore = request.app.state.get_token_store()
    await token_store.revoke(
        claims.token_id,
        *(AccessTokenId(id_) for id_ in access_token_ids),
    )
    if grant_id is not None:
        await _revoke_grant(request, grant_id)


async def _revoke_grant(request: Request, grant_id: int) -> None:
    async with request.app.state.db() as session:
        grant = await session.get(models.OAuth2Grant, grant_id)
        if grant is not None and grant.revoked_at is None:
            grant.revoked_at = datetime.now(timezone.utc)


async def _revoke_grant_on_refresh_replay(request: Request, raw_refresh_token: str) -> None:
    """Revoke the whole grant when a refresh token that was already rotated away is used.

    Rotation spends a refresh token and issues a replacement. Presenting the spent token
    afterwards means it was held by two parties: whoever redeemed it first now holds the
    replacement, and whoever is presenting it now does not. Which of the two is legitimate
    is not knowable from the request, so RFC 9700 Section 4.14.2 requires revoking the
    entire token family rather than guessing. The grant is that family, and the spent
    token's tombstone still names it.

    Tokens that are merely unknown, expired, or unrelated to a grant leave no tombstone
    and fall through here without effect.
    """
    token_store: TokenStore = request.app.state.get_token_store()
    grant_id = await token_store.consumed_refresh_token_grant_id(Token(raw_refresh_token))
    if grant_id is None:
        return
    logger.warning(
        "Refresh token replay detected for OAuth2 grant %d; revoking the grant.",
        grant_id,
    )
    refresh_token_ids: list[RefreshTokenId] = []
    access_token_ids: list[AccessTokenId] = []
    async with request.app.state.db() as session:
        grant = await session.get(models.OAuth2Grant, grant_id)
        if grant is None:
            return
        if grant.revoked_at is None:
            grant.revoked_at = datetime.now(timezone.utc)
        token_rows = await session.execute(
            sa.select(models.RefreshToken.id, models.AccessToken.id)
            .select_from(models.RefreshToken)
            .join(
                models.AccessToken,
                models.AccessToken.refresh_token_id == models.RefreshToken.id,
                isouter=True,
            )
            .where(models.RefreshToken.oauth2_grant_id == grant_id)
        )
        for refresh_token_id, access_token_id in token_rows:
            refresh_token_ids.append(RefreshTokenId(refresh_token_id))
            if access_token_id is not None:
                access_token_ids.append(AccessTokenId(access_token_id))
    await token_store.revoke(*refresh_token_ids, *access_token_ids)


def _dcr_policy() -> RedirectUriDialPosition:
    """The registration policy: who, if anyone, may register a client."""
    return RedirectUriDialPosition(get_env_oauth2_dynamic_client_registration())


def _redirect_uri_dial_position() -> RedirectUriDialPosition:
    """The delivery policy: where an authorization code may be sent.

    Registration and delivery are separate questions that share one setting. Turning
    registration off says nothing about where an already-registered client's code may go,
    and answering DISABLED here would strand every client the server itself seeded — the
    first-party CLI redirects to loopback, so disabling registration would disable login.
    Delivery therefore falls back to the local classes, which is the policy that holds when
    nobody may register: codes reach the approving user's own machine, and nowhere else.
    """
    dial = _dcr_policy()
    if dial is RedirectUriDialPosition.DISABLED:
        return RedirectUriDialPosition.LOCAL_ONLY
    return dial


def _redirect_with_oauth_error(
    redirect_uri: str,
    *,
    error: str,
    state: Optional[str],
) -> RedirectResponse:
    return RedirectResponse(
        url=_with_query_params(redirect_uri, error=error, state=state),
        status_code=302,
    )


def _with_query_params(
    uri: str,
    **params: Optional[str],
) -> str:
    parsed = urlsplit(uri)
    query = parse_qsl(parsed.query, keep_blank_values=True)
    query.extend((key, value) for key, value in params.items() if value is not None)
    return urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            urlencode(query),
            parsed.fragment,
        )
    )


def _form_str(form: Any, key: str) -> Optional[str]:
    value = form.get(key)
    return value if isinstance(value, str) and value else None


def _oauth_error(error: str) -> JSONResponse:
    return _oauth_json_response({"error": error}, status_code=400)


def _dcr_error(error: str, description: str, *, status_code: int = 400) -> JSONResponse:
    return _oauth_json_response(
        {"error": error, "error_description": description},
        status_code=status_code,
    )


def _token_response(
    access_token: object,
    refresh_token: object,
    access_token_expiry: timedelta,
) -> JSONResponse:
    return _oauth_json_response(
        {
            "access_token": str(access_token),
            "token_type": _TOKEN_TYPE,
            "expires_in": int(access_token_expiry.total_seconds()),
            "refresh_token": str(refresh_token),
        }
    )


def _oauth_json_response(
    content: object,
    *,
    status_code: int = 200,
) -> JSONResponse:
    return JSONResponse(
        content,
        status_code=status_code,
        headers=_OAUTH_NO_STORE_HEADERS,
    )


def _clamped_to_grant(expiry: timedelta, grant_expires_at: Optional[datetime]) -> timedelta:
    """Cap a token's lifetime at whatever life the grant has left.

    Nothing sweeps grants when they reach expires_at — the ceiling is only consulted when a
    token is redeemed. A token minted with a lifetime that overruns the grant would therefore
    keep authenticating past the ceiling, since the bearer never has to come back to have it
    checked. Clamping at mint time is what turns the grant ceiling into a real deadline
    rather than one that is merely asked about.
    """
    if grant_expires_at is None:
        return expiry
    remaining = grant_expires_at - datetime.now(timezone.utc)
    if remaining <= timedelta(0):
        return timedelta(seconds=1)
    return min(expiry, remaining)


def _access_token_expiry(request: Request, *, grant_expires_at: Optional[datetime]) -> timedelta:
    assert isinstance(access_token_expiry := request.app.state.access_token_expiry, timedelta)
    return _clamped_to_grant(access_token_expiry, grant_expires_at)


def _refresh_token_expiry(request: Request, *, grant_expires_at: Optional[datetime]) -> timedelta:
    assert isinstance(refresh_token_expiry := request.app.state.refresh_token_expiry, timedelta)
    return _clamped_to_grant(refresh_token_expiry, grant_expires_at)
