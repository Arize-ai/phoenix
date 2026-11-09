"""Resolution of built-in provider credentials and endpoints into provider configs."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Literal, Optional, Union

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import getenv
from phoenix.db import models
from phoenix.db.types.model_provider import (
    AnthropicClientKwargs,
    AnthropicCustomProviderConfig,
    AuthenticationMethodApiKey,
    GenerativeModelCustomerProviderConfigType,
    GoogleGenAIClientKwargs,
    GoogleGenAICustomProviderConfig,
    GoogleGenAIHttpOptions,
    OpenAIClientKwargs,
    OpenAICustomProviderConfig,
    TypeSafeClientKwargs,
    TypeSafeCustomProviderConfig,
    validate_base_url,
    validate_provider_base_urls,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.GenerativeProvider import GenerativeProvider, GenerativeProviderKey

PLACEHOLDER_API_KEY = "sk-placeholder"
"""Sent to servers that need no key, since the SDKs require one."""

BuiltInConfig = Union[
    OpenAICustomProviderConfig,
    AnthropicCustomProviderConfig,
    GoogleGenAICustomProviderConfig,
    TypeSafeCustomProviderConfig,
]


@dataclass(frozen=True)
class BuiltInEndpoint:
    """Environment variable and default endpoint specification for a built-in provider."""

    label: str
    sdk: Literal["openai", "anthropic", "google_genai", "typesafe"]
    api_key_env_vars: tuple[str, ...]
    base_url_env_var: Optional[str] = None
    default_base_url: Optional[str] = None
    base_url_required: bool = False
    base_url_example: Optional[str] = None
    base_url_drops_v1: bool = False
    """Strip a trailing ``/v1`` when ``base_url_env_var`` is shared with an OpenAI-compatible
    ``.../v1`` chat endpoint but this SDK appends ``/v1/...`` itself."""
    organization_env_var: Optional[str] = None
    project_env_var: Optional[str] = None


def credential_env_vars(provider_key: GenerativeProviderKey) -> tuple[str, ...]:
    return tuple(
        requirement.env_var_name
        for requirement in GenerativeProvider.model_provider_to_credential_requirements_map.get(
            provider_key, []
        )
        if requirement.is_required
    )


async def _resolve_secrets(
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    *keys: str,
) -> dict[str, str]:
    """
    Resolve secrets from the database.

    Returns:
        Dictionary mapping key names to their decrypted values.
        Keys not found in the database are omitted.

    Raises:
        BadRequest: If a secret exists but cannot be decrypted.
    """
    secrets = (
        await session.scalars(sa.select(models.Secret).where(models.Secret.key.in_(keys)))
    ).all()
    result: dict[str, str] = {}
    for secret in secrets:
        try:
            result[secret.key] = decrypt(secret.value).decode("utf-8")
        except Exception:
            raise BadRequest(f"Failed to decrypt secret: {secret.key}")
    return result


def _get_credential_from_input(
    credentials: Sequence[GenerativeCredentialInput] | None,
    env_var_name: str,
) -> str | None:
    """Extract a credential value from the input credentials list."""
    if not credentials:
        return None
    return next(
        (c.value.get_secret_value() for c in credentials if c.env_var_name == env_var_name),
        None,
    )


async def resolve_provider_api_key(
    *,
    credentials: Sequence[GenerativeCredentialInput] | None,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    env_var_names: Sequence[str],
    client_base_url: str | None,
    provider_label: str,
) -> str | None:
    """Resolve a provider API key and enforce the custom-base-URL guard.

    Resolution priority: client-supplied credential -> DB-encrypted secret ->
    process environment variable, trying each name in ``env_var_names`` at each step.

    Security: a server-configured (environment variable) API key must never be
    sent to a client-supplied base URL — doing so would leak that credential to
    the client-controlled host (SSRF / credential exfiltration). When the key
    would fall through to an environment variable and the caller also supplied a
    custom ``base_url``, the request is rejected. A key from the request itself or
    from a DB secret is allowed with a custom base URL.
    """
    for name in env_var_names:
        if from_input := _get_credential_from_input(credentials, name):
            return from_input
    secrets = await _resolve_secrets(session, decrypt, *env_var_names)
    for name in env_var_names:
        if from_secret := secrets.get(name):
            return from_secret
    from_env = next((value for name in env_var_names if (value := getenv(name))), None)
    if from_env and client_base_url:
        raise BadRequest(
            f"A custom base URL cannot be used with the server-configured "
            f"{provider_label} API key. Provide an API key with the request, "
            f"or store one as a Phoenix secret, to use a custom base URL."
        )
    return from_env


def checked_base_url(base_url: str) -> str:
    try:
        return validate_base_url(base_url)
    except ValueError as error:
        raise BadRequest(str(error)) from error


def check_provider_base_urls(config: GenerativeModelCustomerProviderConfigType) -> None:
    try:
        validate_provider_base_urls(config)
    except ValueError as error:
        raise BadRequest(str(error)) from error


def _host(url: str) -> str:
    from urllib.parse import urlsplit

    return urlsplit(url).netloc.lower()


def _requires_key(endpoint: BuiltInEndpoint, base_url: Optional[str]) -> bool:
    """Require an API key only when targeting the provider's canonical host; custom or
    local base URLs may not need one."""
    if base_url is None:
        return True
    return endpoint.default_base_url is not None and _host(base_url) == _host(
        endpoint.default_base_url
    )


async def resolve_builtin_config(
    endpoint: BuiltInEndpoint,
    *,
    base_url: Optional[str],
    credentials: Sequence[GenerativeCredentialInput] | None,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    models_label: str = "models",
) -> BuiltInConfig:
    """Resolve ``endpoint`` into a provider config using request overrides, DB secrets,
    and env vars."""
    client_base_url = base_url or None
    resolved = (
        client_base_url
        or (getenv(endpoint.base_url_env_var) if endpoint.base_url_env_var else None)
        or endpoint.default_base_url
    )
    if resolved is None and endpoint.base_url_required:
        example = f" (e.g., {endpoint.base_url_example})" if endpoint.base_url_example else ""
        raise BadRequest(
            f"A base URL is required for {endpoint.label} {models_label}. Set the "
            f"{endpoint.base_url_env_var} environment variable{example} or use a custom "
            "provider."
        )
    if resolved is not None:
        resolved = checked_base_url(resolved).rstrip("/")
        if endpoint.base_url_drops_v1:
            resolved = resolved.removesuffix("/v1")

    api_key: Optional[str] = None
    if endpoint.api_key_env_vars:
        api_key = await resolve_provider_api_key(
            credentials=credentials,
            session=session,
            decrypt=decrypt,
            env_var_names=endpoint.api_key_env_vars,
            client_base_url=client_base_url,
            provider_label=endpoint.label,
        )
        if not api_key and _requires_key(endpoint, resolved):
            raise BadRequest(
                f"An API key is required for {endpoint.label} {models_label}. Set the "
                f"{endpoint.api_key_env_vars[0]} environment variable or use a custom "
                "provider."
            )
    auth = AuthenticationMethodApiKey(api_key=api_key or PLACEHOLDER_API_KEY)

    if endpoint.sdk == "openai":
        return OpenAICustomProviderConfig(
            openai_authentication_method=auth,
            openai_client_kwargs=OpenAIClientKwargs(
                base_url=resolved,
                organization=getenv(endpoint.organization_env_var)
                if endpoint.organization_env_var
                else None,
                project=getenv(endpoint.project_env_var) if endpoint.project_env_var else None,
            ),
            openai_api_type="chat_completions",
        )
    if endpoint.sdk == "anthropic":
        return AnthropicCustomProviderConfig(
            anthropic_authentication_method=auth,
            anthropic_client_kwargs=AnthropicClientKwargs(base_url=resolved),
        )
    if endpoint.sdk == "google_genai":
        return GoogleGenAICustomProviderConfig(
            google_genai_authentication_method=auth,
            google_genai_client_kwargs=GoogleGenAIClientKwargs(
                http_options=GoogleGenAIHttpOptions(base_url=resolved)
            ),
        )
    return TypeSafeCustomProviderConfig(
        typesafe_authentication_method=auth,
        typesafe_client_kwargs=TypeSafeClientKwargs(base_url=resolved),
    )
