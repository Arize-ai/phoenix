"""Stateless pass-through routes for the ChatGPT/Codex device-code login.

Experimental (see ``phoenix.server.agents.codex``). The browser drives the
flow and holds every token; these routes only relay calls the browser cannot
make itself (CORS) and never store anything. They sit behind the same guards
as the agent routes.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from pydantic.alias_generators import to_camel

from phoenix.server.agents import codex
from phoenix.server.api.routers.v1.utils import add_errors_to_responses
from phoenix.server.authorization import (
    is_agent_assistant_enabled,
    is_not_locked,
    prevent_access_in_read_only_mode,
    restrict_access_by_viewers,
)
from phoenix.server.bearer_auth import is_authenticated


class _CamelBaseModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CodexDeviceAuthStartResponseBody(_CamelBaseModel):
    device_auth_id: str
    user_code: str = Field(description="One-time code the user types at ``verificationUrl``.")
    interval_seconds: int = Field(description="Suggested polling interval.")
    verification_url: str
    expires_in_seconds: int = Field(
        default=15 * 60,
        description="The user code expires roughly this long after it was issued.",
    )


class CodexDeviceAuthPollRequestBody(_CamelBaseModel):
    device_auth_id: str
    user_code: str


class CodexTokenBundle(_CamelBaseModel):
    """The browser-held credential set. Returned once; never stored server-side."""

    access_token: str
    refresh_token: str
    id_token: str | None = None
    account_id: str


class CodexDeviceAuthPollResponseBody(_CamelBaseModel):
    status: Literal["pending", "complete"]
    tokens: CodexTokenBundle | None = None


class CodexRefreshRequestBody(_CamelBaseModel):
    refresh_token: SecretStr


class CodexModelsRequestBody(_CamelBaseModel):
    access_token: SecretStr


class CodexModelsResponseBody(_CamelBaseModel):
    models: list[str] = Field(description="Model slugs the subscription can use.")


def _to_bundle(tokens: codex.CodexTokens) -> CodexTokenBundle:
    return CodexTokenBundle(
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
        Depends(is_not_locked),
    ]
    if authentication_enabled:
        dependencies.append(Depends(is_authenticated))
    router = APIRouter(prefix="/v1/codex", tags=["chat"], dependencies=dependencies)

    @router.post(
        "/device_auth",
        operation_id="startCodexDeviceAuth",
        response_model_by_alias=True,
        responses=add_errors_to_responses([401, 403, 502]),
    )
    async def start_device_auth() -> CodexDeviceAuthStartResponseBody:
        """Begin a ChatGPT device-code sign-in for the public Codex client."""
        try:
            async with codex.http_client() as client:
                started = await codex.start_device_auth(client)
        except codex.CodexAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        return CodexDeviceAuthStartResponseBody(
            device_auth_id=started.device_auth_id,
            user_code=started.user_code,
            interval_seconds=started.interval_seconds,
            verification_url=started.verification_url,
        )

    @router.post(
        "/device_auth/poll",
        operation_id="pollCodexDeviceAuth",
        response_model_by_alias=True,
        responses=add_errors_to_responses([401, 403, 502]),
    )
    async def poll_device_auth(
        request_body: CodexDeviceAuthPollRequestBody,
    ) -> CodexDeviceAuthPollResponseBody:
        """One poll of a device-code sign-in. Completes with the token bundle."""
        try:
            async with codex.http_client() as client:
                tokens = await codex.poll_device_auth(
                    client,
                    device_auth_id=request_body.device_auth_id,
                    user_code=request_body.user_code,
                )
        except codex.CodexAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        if tokens is None:
            return CodexDeviceAuthPollResponseBody(status="pending")
        return CodexDeviceAuthPollResponseBody(status="complete", tokens=_to_bundle(tokens))

    @router.post(
        "/refresh",
        operation_id="refreshCodexTokens",
        response_model_by_alias=True,
        responses=add_errors_to_responses([401, 403, 502]),
    )
    async def refresh(request_body: CodexRefreshRequestBody) -> CodexTokenBundle:
        """Rotate the browser's refresh token. Refresh tokens are single-use."""
        try:
            async with codex.http_client() as client:
                tokens = await codex.refresh_tokens(
                    client,
                    refresh_token=request_body.refresh_token.get_secret_value(),
                )
        except codex.CodexAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        return _to_bundle(tokens)

    @router.post(
        "/models",
        operation_id="listCodexModels",
        response_model_by_alias=True,
        responses=add_errors_to_responses([401, 403, 502]),
    )
    async def list_models(request_body: CodexModelsRequestBody) -> CodexModelsResponseBody:
        """Models the signed-in ChatGPT subscription can use."""
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
