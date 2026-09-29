"""ChatGPT (Codex subscription) sign-in for the assistant.

The browser cannot call ``auth.openai.com`` directly (no CORS), so Phoenix relays
the OAuth 2.0 Device Authorization Grant (RFC 8628) on its behalf. The routes are
stateless: every token lives in the browser, and the server never stores one.

The public contract follows the RFC rather than OpenAI's private device-auth API,
which is a non-standard two-step variant of it. ``/device_authorization`` starts
the grant and ``/token`` completes or refreshes it, exactly as an OAuth client
library would expect. OpenAI's intermediate authorization code and PKCE verifier
never leave the server.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, SecretStr

from phoenix.server.agents import codex
from phoenix.server.api.routers.v1.utils import add_errors_to_responses
from phoenix.server.authorization import (
    is_agent_assistant_enabled,
    prevent_access_in_read_only_mode,
    restrict_access_by_viewers,
)
from phoenix.server.bearer_auth import is_authenticated

DEVICE_CODE_GRANT_TYPE: Literal["urn:ietf:params:oauth:grant-type:device_code"] = (
    "urn:ietf:params:oauth:grant-type:device_code"
)
REFRESH_TOKEN_GRANT_TYPE: Literal["refresh_token"] = "refresh_token"

# OpenAI does not report how long a user code stays valid; the Codex CLI assumes
# fifteen minutes.
_DEVICE_CODE_LIFETIME_SECONDS = 15 * 60


class CodexDeviceAuthorizationResponse(BaseModel):
    """RFC 8628 §3.2 device authorization response."""

    device_code: str = Field(
        description="Opaque handle to present to the token endpoint while polling."
    )
    user_code: str = Field(description="Short code the user types at ``verification_uri``.")
    verification_uri: str
    expires_in: int = Field(description="Lifetime of ``device_code`` and ``user_code`` in seconds.")
    interval: int = Field(description="Minimum seconds to wait between token requests.")


class CodexTokenResponse(BaseModel):
    """RFC 6749 §5.1 token response, plus the ChatGPT ``account_id`` extension parameter.

    Returned once per grant; the server keeps no copy.
    """

    access_token: str
    token_type: Literal["Bearer"] = "Bearer"
    refresh_token: str = Field(description="Single-use: replace the stored bundle on refresh.")
    id_token: str | None = None
    account_id: str = Field(description="ChatGPT account the tokens belong to.")


CodexTokenErrorCode = Literal[
    "authorization_pending",
    "expired_token",
    "access_denied",
    "invalid_grant",
    "invalid_request",
    "unsupported_grant_type",
    "temporarily_unavailable",
]


class CodexTokenErrorResponse(BaseModel):
    """RFC 6749 §5.2 / RFC 8628 §3.5 token error response."""

    error: CodexTokenErrorCode
    error_description: str | None = None


class CodexModelsRequestBody(BaseModel):
    access_token: SecretStr


class CodexModelsResponseBody(BaseModel):
    models: list[str] = Field(description="Model slugs the subscription can use.")


def _token_error(
    error: CodexTokenErrorCode,
    description: str,
    *,
    status_code: int = 400,
) -> JSONResponse:
    body = CodexTokenErrorResponse(error=error, error_description=description)
    return JSONResponse(
        body.model_dump(exclude_none=True),
        status_code=status_code,
        headers={"Cache-Control": "no-store"},
    )


def _upstream_token_error(exc: codex.CodexAuthError) -> JSONResponse:
    # The helper reports a rejected grant as 401 and everything else as 502.
    if exc.status_code == 401:
        return _token_error("invalid_grant", str(exc))
    return _token_error("temporarily_unavailable", str(exc), status_code=502)


def _token_response(tokens: codex.CodexTokens) -> CodexTokenResponse:
    return CodexTokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        id_token=tokens.id_token,
        account_id=tokens.account_id,
    )


def create_codex_auth_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [
        Depends(is_agent_assistant_enabled),
        Depends(prevent_access_in_read_only_mode),
        Depends(restrict_access_by_viewers),
    ]
    if authentication_enabled:
        dependencies.append(Depends(is_authenticated))
    router = APIRouter(prefix="/codex", tags=["chat"], dependencies=dependencies)

    @router.post(
        "/device_authorization",
        operation_id="codexDeviceAuthorization",
        responses=add_errors_to_responses([401, 403, 502]),
    )
    async def device_authorization() -> CodexDeviceAuthorizationResponse:
        """Start a ChatGPT device-code sign-in (RFC 8628 §3.1).

        Phoenix supplies the public Codex ``client_id``, so the request carries no body.
        """
        try:
            async with codex.http_client() as client:
                started = await codex.start_device_auth(client)
        except codex.CodexAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        return CodexDeviceAuthorizationResponse(
            device_code=codex.encode_device_code(
                device_auth_id=started.device_auth_id,
                user_code=started.user_code,
            ),
            user_code=started.user_code,
            verification_uri=started.verification_url,
            expires_in=_DEVICE_CODE_LIFETIME_SECONDS,
            interval=started.interval_seconds,
        )

    @router.post(
        "/token",
        operation_id="codexToken",
        response_model=CodexTokenResponse,
        responses={
            400: {
                "model": CodexTokenErrorResponse,
                "description": (
                    "``authorization_pending`` until the user finishes signing in; "
                    "``invalid_grant`` for a rejected, expired, or spent grant."
                ),
            },
            502: {"model": CodexTokenErrorResponse, "description": "OpenAI was unreachable."},
            **add_errors_to_responses([401, 403]),
        },
    )
    async def token(
        grant_type: Annotated[str, Form()],
        device_code: Annotated[str | None, Form()] = None,
        refresh_token: Annotated[str | None, Form()] = None,
    ) -> CodexTokenResponse | JSONResponse:
        """Complete or refresh a ChatGPT sign-in (RFC 8628 §3.4, RFC 6749 §6).

        Poll with ``grant_type=urn:ietf:params:oauth:grant-type:device_code`` and the
        ``device_code`` from ``/device_authorization`` until the response is no longer
        ``authorization_pending``. Refresh with ``grant_type=refresh_token``; refresh
        tokens are single-use.
        """
        if grant_type == DEVICE_CODE_GRANT_TYPE:
            if not device_code:
                return _token_error("invalid_request", "device_code is required.")
            decoded = codex.decode_device_code(device_code)
            if decoded is None:
                return _token_error("invalid_grant", "Unrecognized device_code.")
            device_auth_id, user_code = decoded
            try:
                async with codex.http_client() as client:
                    tokens = await codex.poll_device_auth(
                        client,
                        device_auth_id=device_auth_id,
                        user_code=user_code,
                    )
            except codex.CodexAuthError as exc:
                return _upstream_token_error(exc)
            if tokens is None:
                return _token_error(
                    "authorization_pending",
                    "The user has not finished signing in.",
                )
            return _token_response(tokens)
        if grant_type == REFRESH_TOKEN_GRANT_TYPE:
            if not refresh_token:
                return _token_error("invalid_request", "refresh_token is required.")
            try:
                async with codex.http_client() as client:
                    tokens = await codex.refresh_tokens(client, refresh_token=refresh_token)
            except codex.CodexAuthError as exc:
                return _upstream_token_error(exc)
            return _token_response(tokens)
        return _token_error(
            "unsupported_grant_type",
            f"grant_type must be {DEVICE_CODE_GRANT_TYPE} or {REFRESH_TOKEN_GRANT_TYPE}.",
        )

    @router.post(
        "/models",
        operation_id="listCodexModels",
        responses=add_errors_to_responses([401, 403, 502]),
    )
    async def list_models(request_body: CodexModelsRequestBody) -> CodexModelsResponseBody:
        """Models the signed-in ChatGPT subscription can use.

        A POST so the access token travels in the body: the ``Authorization`` header
        already carries the Phoenix session.
        """
        try:
            async with codex.http_client() as client:
                models = await codex.list_models(
                    client,
                    access_token=request_body.access_token.get_secret_value(),
                )
        except codex.CodexAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        return CodexModelsResponseBody(models=models)

    return router
