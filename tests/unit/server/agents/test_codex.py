import base64
import json
from typing import Any

import httpx
import pytest
from pydantic import SecretStr

from phoenix.server.agents import codex
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.model_selection import BuiltInProviderModelSelection
from phoenix.server.types import DbSessionFactory


def _jwt(claims: dict[str, Any]) -> str:
    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    return ".".join(
        [b64(json.dumps({"alg": "none"}).encode()), b64(json.dumps(claims).encode()), "sig"]
    )


ACCESS_TOKEN = _jwt({"https://api.openai.com/auth": {"chatgpt_account_id": "acct_123"}, "exp": 1})


class TestAccountId:
    def test_nested_claim(self) -> None:
        assert codex.account_id_from_token(ACCESS_TOKEN) == "acct_123"

    def test_top_level_fallbacks(self) -> None:
        assert codex.account_id_from_token(_jwt({"chatgpt_account_id": "a"})) == "a"
        assert codex.account_id_from_token(_jwt({"account_id": "b"})) == "b"

    def test_malformed(self) -> None:
        assert codex.account_id_from_token("not-a-jwt") is None
        assert codex.account_id_from_token("x.!!!.y") is None


class TestBuildCodexModel:
    async def test_requires_request_credential(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # The API key must never be used as a fallback for subscription auth.
        monkeypatch.setenv("OPENAI_API_KEY", "sk-should-not-be-used")
        params = BuiltInProviderModelSelection(
            provider_type="builtin",
            provider="OPENAI_CODEX",
            model_name="gpt-5.4",
        )
        with pytest.raises(Exception) as exc_info:
            await build_model(params, db=db, decrypt=lambda value: value)
        assert "not signed in to ChatGPT" in str(exc_info.value)

    async def test_builds_responses_model_on_codex_backend(
        self,
        db: DbSessionFactory,
    ) -> None:
        params = BuiltInProviderModelSelection(
            provider_type="builtin",
            provider="OPENAI_CODEX",
            model_name="gpt-5.4",
        )
        model = await build_model(
            params,
            db=db,
            decrypt=lambda value: value,
            request_credentials={codex.CODEX_ACCESS_TOKEN_SECRET_KEY: SecretStr(ACCESS_TOKEN)},
        )
        inner: Any = model.wrapped if hasattr(model, "wrapped") else model
        provider = inner._provider
        assert provider.name == "openai-codex"
        assert provider.base_url == "https://chatgpt.com/backend-api/codex"
        assert provider.credentials.access_token == ACCESS_TOKEN
        assert provider.credentials.account_id == "acct_123"
        assert inner.profile.get("openai_responses_requires_store_false") is True
        assert inner.profile.get("openai_responses_requires_streaming") is True

    async def test_token_without_account_id_is_rejected(
        self,
        db: DbSessionFactory,
    ) -> None:
        params = BuiltInProviderModelSelection(
            provider_type="builtin",
            provider="OPENAI_CODEX",
            model_name="gpt-5.4",
        )
        with pytest.raises(Exception) as exc_info:
            await build_model(
                params,
                db=db,
                decrypt=lambda value: value,
                request_credentials={
                    codex.CODEX_ACCESS_TOKEN_SECRET_KEY: SecretStr(_jwt({"sub": "x"}))
                },
            )
        assert "account id" in str(exc_info.value)


def _client(handler: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


class TestDeviceFlow:
    async def test_start(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/api/accounts/deviceauth/usercode"
            assert json.loads(request.content) == {"client_id": codex.CODEX_CLIENT_ID}
            return httpx.Response(
                200,
                json={"device_auth_id": "dev_1", "user_code": "ABCD-EFGH", "interval": "5"},
            )

        async with _client(handler) as client:
            started = await codex.start_device_auth(client)
        assert started.device_auth_id == "dev_1"
        assert started.user_code == "ABCD-EFGH"
        assert started.interval_seconds == 5
        assert started.verification_url == "https://auth.openai.com/codex/device"

    async def test_poll_pending(self) -> None:
        async with _client(lambda _: httpx.Response(403)) as client:
            assert (
                await codex.poll_device_auth(client, device_auth_id="dev_1", user_code="X") is None
            )

    async def test_poll_complete_exchanges_code(self) -> None:
        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(request.url.path)
            if request.url.path == "/api/accounts/deviceauth/token":
                return httpx.Response(
                    200, json={"authorization_code": "code_1", "code_verifier": "ver_1"}
                )
            assert request.url.path == "/oauth/token"
            form = dict(
                pair.split("=", 1) for pair in request.content.decode().split("&") if "=" in pair
            )
            assert form["grant_type"] == "authorization_code"
            assert form["code"] == "code_1"
            assert form["code_verifier"] == "ver_1"
            assert form["client_id"] == codex.CODEX_CLIENT_ID
            return httpx.Response(
                200,
                json={
                    "access_token": ACCESS_TOKEN,
                    "refresh_token": "rt_1",
                    "id_token": ACCESS_TOKEN,
                },
            )

        async with _client(handler) as client:
            tokens = await codex.poll_device_auth(client, device_auth_id="dev_1", user_code="X")
        assert tokens is not None
        assert tokens.refresh_token == "rt_1"
        assert tokens.account_id == "acct_123"
        assert calls == ["/api/accounts/deviceauth/token", "/oauth/token"]

    async def test_refresh_invalid_grant_is_401(self) -> None:
        async with _client(
            lambda _: httpx.Response(400, json={"error": "invalid_grant"})
        ) as client:
            with pytest.raises(codex.CodexAuthError) as exc_info:
                await codex.refresh_tokens(client, refresh_token="stale")
        assert exc_info.value.status_code == 401

    async def test_list_models(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.host == "chatgpt.com"
            assert request.url.params["client_version"]
            assert request.headers["authorization"] == f"Bearer {ACCESS_TOKEN}"
            assert request.headers["chatgpt-account-id"] == "acct_123"
            return httpx.Response(
                200,
                json={
                    "models": [
                        {"slug": "gpt-5.4", "visibility": "list"},
                        {"slug": "gpt-5.4", "visibility": "list"},
                        {"slug": "codex-auto-review", "visibility": "hide"},
                        {"slug": "o3"},
                    ]
                },
            )

        async with _client(handler) as client:
            assert await codex.list_models(client, access_token=ACCESS_TOKEN) == ["gpt-5.4", "o3"]
