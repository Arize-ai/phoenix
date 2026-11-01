import json
import logging
import traceback
from typing import Any

import httpx
import pytest

from phoenix.client.constants.server_requirements import UPSERT_OR_DELETE_SECRETS
from phoenix.client.resources.secrets import AsyncSecrets, Secrets
from phoenix.client.utils.server_requirements import CapabilityRequirement

SENTINEL = "sk-sentinel-DO-NOT-LEAK-8f3a1c"


def _ok_handler(captured: list[httpx.Request]) -> Any:
    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        body = json.loads(request.content)
        upserted = [s["key"] for s in body["secrets"] if s["value"] is not None]
        deleted = [s["key"] for s in body["secrets"] if s["value"] is None]
        return httpx.Response(
            200, json={"data": {"upserted_keys": upserted, "deleted_keys": deleted}}
        )

    return handler


def _echoing_422_handler(request: httpx.Request) -> httpx.Response:
    """Mimic FastAPI's 422 body, which echoes the submitted input."""
    return httpx.Response(
        422,
        json={
            "detail": [
                {
                    "type": "value_error",
                    "loc": ["body", "secrets", 0, "value"],
                    "msg": "Value error, Value cannot be empty",
                    "input": SENTINEL,
                    "ctx": {"error": SENTINEL},
                }
            ]
        },
    )


def _echoing_500_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(500, text=f"boom: {request.content.decode()}")


def _sync(handler: Any) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")


def _async(handler: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")


def _assert_no_leak(exc: BaseException) -> None:
    rendered = "".join(traceback.format_exception(exc))
    assert SENTINEL not in rendered
    assert SENTINEL not in repr(exc)
    assert exc.__cause__ is None
    assert exc.__suppress_context__
    if isinstance(exc, httpx.HTTPStatusError):
        assert SENTINEL.encode() not in exc.request.content
        assert SENTINEL not in exc.response.text


class TestSecretsUpsertOrDelete:
    def test_sends_put_with_key_value_entries_and_returns_typed_result(self) -> None:
        captured: list[httpx.Request] = []
        client = _sync(_ok_handler(captured))
        result = Secrets(client).upsert_or_delete(
            secrets={"OPENAI_API_KEY": SENTINEL, "OLD_PROVIDER_API_KEY": None}
        )
        assert len(captured) == 1
        request = captured[0]
        assert request.method == "PUT"
        assert request.url.path == "/v1/secrets"
        assert json.loads(request.content) == {
            "secrets": [
                {"key": "OPENAI_API_KEY", "value": SENTINEL},
                {"key": "OLD_PROVIDER_API_KEY", "value": None},
            ]
        }
        assert result == {
            "upserted_keys": ["OPENAI_API_KEY"],
            "deleted_keys": ["OLD_PROVIDER_API_KEY"],
        }
        assert SENTINEL not in repr(result)

    def test_rejects_empty_batch_without_sending(self) -> None:
        captured: list[httpx.Request] = []
        client = _sync(_ok_handler(captured))
        with pytest.raises(ValueError, match="At least one secret is required"):
            Secrets(client).upsert_or_delete(secrets={})
        assert captured == []

    def test_requires_minimum_server_version(self) -> None:
        required: list[CapabilityRequirement] = []

        class _Guard:
            def require(self, requirement: CapabilityRequirement) -> None:
                required.append(requirement)

        client = _sync(_ok_handler([]))
        Secrets(client, _guard=_Guard()).upsert_or_delete(  # type: ignore[arg-type]
            secrets={"K": "v"}
        )
        assert required == [UPSERT_OR_DELETE_SECRETS]
        assert UPSERT_OR_DELETE_SECRETS.method == "PUT"
        assert UPSERT_OR_DELETE_SECRETS.path == "/v1/secrets"

    @pytest.mark.parametrize("handler", [_echoing_422_handler, _echoing_500_handler])
    def test_http_errors_do_not_leak_values(
        self, handler: Any, caplog: pytest.LogCaptureFixture
    ) -> None:
        caplog.set_level(logging.DEBUG)
        client = _sync(handler)
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            Secrets(client).upsert_or_delete(secrets={"OPENAI_API_KEY": SENTINEL})
        _assert_no_leak(exc_info.value)
        assert SENTINEL not in caplog.text

    def test_422_error_keeps_validation_message(self) -> None:
        client = _sync(_echoing_422_handler)
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            Secrets(client).upsert_or_delete(secrets={"OPENAI_API_KEY": SENTINEL})
        message = str(exc_info.value)
        assert "422" in message
        assert "body.secrets.0.value: Value error, Value cannot be empty" in message
        assert exc_info.value.response.status_code == 422

    def test_repr_does_not_leak_values(self, caplog: pytest.LogCaptureFixture) -> None:
        caplog.set_level(logging.DEBUG)
        resource = Secrets(_sync(_ok_handler([])))
        resource.upsert_or_delete(secrets={"OPENAI_API_KEY": SENTINEL})
        assert SENTINEL not in repr(resource)
        assert SENTINEL not in caplog.text


class TestAsyncSecretsUpsertOrDelete:
    async def test_sends_put_with_key_value_entries_and_returns_typed_result(self) -> None:
        captured: list[httpx.Request] = []
        client = _async(_ok_handler(captured))
        result = await AsyncSecrets(client).upsert_or_delete(
            secrets={"OPENAI_API_KEY": SENTINEL, "OLD_PROVIDER_API_KEY": None}
        )
        assert len(captured) == 1
        assert captured[0].method == "PUT"
        assert captured[0].url.path == "/v1/secrets"
        assert json.loads(captured[0].content) == {
            "secrets": [
                {"key": "OPENAI_API_KEY", "value": SENTINEL},
                {"key": "OLD_PROVIDER_API_KEY", "value": None},
            ]
        }
        assert result == {
            "upserted_keys": ["OPENAI_API_KEY"],
            "deleted_keys": ["OLD_PROVIDER_API_KEY"],
        }

    async def test_rejects_empty_batch_without_sending(self) -> None:
        captured: list[httpx.Request] = []
        client = _async(_ok_handler(captured))
        with pytest.raises(ValueError, match="At least one secret is required"):
            await AsyncSecrets(client).upsert_or_delete(secrets={})
        assert captured == []

    async def test_requires_minimum_server_version(self) -> None:
        required: list[CapabilityRequirement] = []

        class _Guard:
            async def require(self, requirement: CapabilityRequirement) -> None:
                required.append(requirement)

        client = _async(_ok_handler([]))
        await AsyncSecrets(client, _guard=_Guard()).upsert_or_delete(  # type: ignore[arg-type]
            secrets={"K": "v"}
        )
        assert required == [UPSERT_OR_DELETE_SECRETS]

    @pytest.mark.parametrize("handler", [_echoing_422_handler, _echoing_500_handler])
    async def test_http_errors_do_not_leak_values(
        self, handler: Any, caplog: pytest.LogCaptureFixture
    ) -> None:
        caplog.set_level(logging.DEBUG)
        client = _async(handler)
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            await AsyncSecrets(client).upsert_or_delete(secrets={"OPENAI_API_KEY": SENTINEL})
        _assert_no_leak(exc_info.value)
        assert SENTINEL not in caplog.text


def test_client_exposes_secrets_resource() -> None:
    from phoenix.client import AsyncClient, Client

    sync_client = Client(base_url="http://test", http_client=_sync(_ok_handler([])))
    async_client = AsyncClient(base_url="http://test", http_client=_async(_ok_handler([])))
    assert isinstance(sync_client.secrets, Secrets)
    assert isinstance(async_client.secrets, AsyncSecrets)
