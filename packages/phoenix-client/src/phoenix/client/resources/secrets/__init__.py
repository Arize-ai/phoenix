from __future__ import annotations

from typing import Any, Mapping, Optional, cast

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.constants.server_requirements import UPSERT_OR_DELETE_SECRETS
from phoenix.client.utils.server_requirements import (
    AsyncServerVersionGuard,
    ServerVersionGuard,
)

_ERROR_PREFIX = "Failed to upsert or delete secrets"


class Secrets:
    """Client for managing Phoenix secrets (encrypted LLM provider credentials).

    Secrets are write-only: values are sent to the server, encrypted at rest, and
    never returned. Responses report only which keys were upserted or deleted.
    Managing secrets requires an admin API key when authentication is enabled.

    Examples:
        Create, rotate, and delete secrets::

            import os

            from phoenix.client import Client

            client = Client()

            # Create (or rotate) a secret, and delete another, in one atomic request
            result = client.secrets.upsert_or_delete(
                secrets={
                    "OPENAI_API_KEY": os.environ["OPENAI_API_KEY"],
                    "OLD_PROVIDER_API_KEY": None,
                }
            )
            print(result["upserted_keys"], result["deleted_keys"])
    """

    def __init__(
        self,
        client: httpx.Client,
        *,
        _guard: ServerVersionGuard | None = None,
    ) -> None:
        """Initialize the Secrets client.

        Args:
            client (httpx.Client): The httpx client to use for making requests.
        """
        self._client = client
        self._guard = _guard or ServerVersionGuard(client)

    def upsert_or_delete(
        self,
        *,
        secrets: Mapping[str, Optional[str]],
    ) -> v1.UpsertOrDeleteSecretsResult:
        """Atomically create, update, or delete a batch of secrets.

        Each entry maps a secret key to either a string value, which creates the
        secret or replaces (rotates) its existing value, or ``None``, which deletes
        the secret. Deleting a key that does not exist succeeds silently. All
        entries are applied in a single transaction.

        Secret values are never included in the result, in log messages, or in the
        errors raised by this method.

        Args:
            secrets (Mapping[str, Optional[str]]): Secret keys mapped to their new
                values, or to ``None`` to delete them. Keys must start with a letter
                or underscore and contain only letters, digits, and underscores.

        Returns:
            The keys that were upserted and the keys that were deleted.

        Raises:
            ValueError: If ``secrets`` is empty.
            httpx.HTTPStatusError: If the server rejects the request. The error's
                message, request, and response do not include the submitted values.
            PhoenixException: If the server is older than Phoenix 13.21.0.

        Example::

            from phoenix.client import Client

            client = Client()

            # Rotate a key: upserting an existing key replaces its value
            client.secrets.upsert_or_delete(secrets={"OPENAI_API_KEY": new_api_key})

            # Delete a key
            client.secrets.upsert_or_delete(secrets={"OPENAI_API_KEY": None})
        """
        body = _build_request_body(secrets)
        self._guard.require(UPSERT_OR_DELETE_SECRETS)
        response = self._client.put("v1/secrets", json=body)
        return _parse_response(response)


class AsyncSecrets:
    """Asynchronous client for managing Phoenix secrets (encrypted LLM provider credentials).

    Secrets are write-only: values are sent to the server, encrypted at rest, and
    never returned. Responses report only which keys were upserted or deleted.
    Managing secrets requires an admin API key when authentication is enabled.

    Examples:
        Create, rotate, and delete secrets::

            import os

            from phoenix.client import AsyncClient

            client = AsyncClient()

            # Create (or rotate) a secret, and delete another, in one atomic request
            result = await client.secrets.upsert_or_delete(
                secrets={
                    "OPENAI_API_KEY": os.environ["OPENAI_API_KEY"],
                    "OLD_PROVIDER_API_KEY": None,
                }
            )
            print(result["upserted_keys"], result["deleted_keys"])
    """  # noqa: E501

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        _guard: AsyncServerVersionGuard | None = None,
    ) -> None:
        """Initialize the AsyncSecrets client.

        Args:
            client (httpx.AsyncClient): The httpx async client to use for making requests.
        """
        self._client = client
        self._guard = _guard or AsyncServerVersionGuard(client)

    async def upsert_or_delete(
        self,
        *,
        secrets: Mapping[str, Optional[str]],
    ) -> v1.UpsertOrDeleteSecretsResult:
        """Atomically create, update, or delete a batch of secrets.

        Each entry maps a secret key to either a string value, which creates the
        secret or replaces (rotates) its existing value, or ``None``, which deletes
        the secret. Deleting a key that does not exist succeeds silently. All
        entries are applied in a single transaction.

        Secret values are never included in the result, in log messages, or in the
        errors raised by this method.

        Args:
            secrets (Mapping[str, Optional[str]]): Secret keys mapped to their new
                values, or to ``None`` to delete them. Keys must start with a letter
                or underscore and contain only letters, digits, and underscores.

        Returns:
            The keys that were upserted and the keys that were deleted.

        Raises:
            ValueError: If ``secrets`` is empty.
            httpx.HTTPStatusError: If the server rejects the request. The error's
                message, request, and response do not include the submitted values.
            PhoenixException: If the server is older than Phoenix 13.21.0.

        Example::

            from phoenix.client import AsyncClient

            client = AsyncClient()

            # Rotate a key: upserting an existing key replaces its value
            await client.secrets.upsert_or_delete(secrets={"OPENAI_API_KEY": new_api_key})

            # Delete a key
            await client.secrets.upsert_or_delete(secrets={"OPENAI_API_KEY": None})
        """
        body = _build_request_body(secrets)
        await self._guard.require(UPSERT_OR_DELETE_SECRETS)
        response = await self._client.put("v1/secrets", json=body)
        return _parse_response(response)


def _build_request_body(
    secrets: Mapping[str, Optional[str]],
) -> v1.UpsertOrDeleteSecretsRequest:
    # Mirrors the server, which rejects an empty batch with 422.
    if not secrets:
        raise ValueError("At least one secret is required")
    return v1.UpsertOrDeleteSecretsRequest(
        secrets=[v1.SecretKeyValue(key=key, value=value) for key, value in secrets.items()]
    )


def _parse_response(response: httpx.Response) -> v1.UpsertOrDeleteSecretsResult:
    if response.is_error:
        raise _redacted_status_error(response) from None
    return cast(v1.ResponseBodyUpsertOrDeleteSecretsResult, response.json())["data"]


def _redacted_status_error(response: httpx.Response) -> httpx.HTTPStatusError:
    """Build an HTTPStatusError that carries no submitted secret values.

    The original request holds the secret values in its body, and the server's
    error body may echo them (e.g. FastAPI's 422 ``input`` field), so neither is
    attached to the raised error. Only the method, URL, status code, and, for
    422 responses, the location and message of each validation error are kept.
    """
    request = httpx.Request(response.request.method, response.request.url)
    redacted_response = httpx.Response(response.status_code, request=request)
    message = f"{_ERROR_PREFIX}: HTTP {response.status_code} {redacted_response.reason_phrase}"
    if response.status_code == 422:
        details = _validation_error_messages(response)
        if details:
            message += ": " + "; ".join(details)
    return httpx.HTTPStatusError(message, request=request, response=redacted_response)


def _validation_error_messages(response: httpx.Response) -> list[str]:
    # FastAPI 422 bodies look like {"detail": [{"loc": [...], "msg": "...", "input": ...}]}.
    # Only "loc" and "msg" are used; "input" and "ctx" can echo submitted values.
    messages: list[str] = []
    try:
        errors: list[dict[str, Any]] = response.json()["detail"]
        for error in errors:
            msg = error["msg"]
            if isinstance(msg, str):
                location = ".".join(str(part) for part in error["loc"])
                messages.append(f"{location}: {msg}")
    except Exception:
        return []
    return messages
