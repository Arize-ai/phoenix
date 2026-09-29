from __future__ import annotations

import base64
import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from phoenix.server.agents import codex
from phoenix.server.api.routers.codex_auth import (
    AUTHORIZATION_CODE_GRANT_TYPE,
    DEVICE_CODE_GRANT_TYPE,
)
from phoenix.server.settings.registry import AgentAssistantEnabledSetting


def _jwt(claims: dict[str, Any]) -> str:
    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    return ".".join(
        [b64(json.dumps({"alg": "none"}).encode()), b64(json.dumps(claims).encode()), "sig"]
    )


ACCESS_TOKEN = _jwt({"https://api.openai.com/auth": {"chatgpt_account_id": "acct_123"}})
TOKEN_JSON = {"access_token": ACCESS_TOKEN, "refresh_token": "rt_1", "id_token": ACCESS_TOKEN}


@pytest.fixture
def upstream(
    monkeypatch: pytest.MonkeyPatch,
) -> Callable[[Callable[[httpx.Request], httpx.Response]], None]:
    """Route the router's outbound OpenAI calls to a fake."""

    def install(handler: Callable[[httpx.Request], httpx.Response]) -> None:
        monkeypatch.setattr(
            codex,
            "http_client",
            lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

    return install


async def test_authorization_url_mints_a_pkce_pair_without_calling_upstream(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise AssertionError("upstream must not be called")

    upstream(handler)

    response = await httpx_client.post("/codex/authorization_url")

    assert response.status_code == 200
    body = response.json()
    url = httpx.URL(body["authorization_url"])
    assert str(url.copy_with(query=None)) == codex.CODEX_AUTHORIZE_URL
    assert url.params["client_id"] == codex.CODEX_CLIENT_ID
    assert url.params["redirect_uri"] == body["redirect_uri"] == codex.CODEX_BROWSER_REDIRECT_URI
    assert url.params["state"] == body["state"]
    assert url.params["code_challenge_method"] == "S256"
    assert url.params["code_challenge"] == codex.pkce_challenge(body["code_verifier"])


async def test_token_exchanges_a_pasted_authorization_code(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/oauth/token"
        form = dict(pair.split("=", 1) for pair in request.content.decode().split("&"))
        assert form["grant_type"] == "authorization_code"
        assert form["code"] == "code_1"
        assert form["code_verifier"] == "ver_1"
        assert form["client_id"] == codex.CODEX_CLIENT_ID
        return httpx.Response(200, json=TOKEN_JSON)

    upstream(handler)

    response = await httpx_client.post(
        "/codex/token",
        data={
            "grant_type": AUTHORIZATION_CODE_GRANT_TYPE,
            "code": "code_1",
            "code_verifier": "ver_1",
        },
    )

    assert response.status_code == 200
    assert response.json()["account_id"] == "acct_123"


async def test_token_maps_a_spent_authorization_code_to_invalid_grant(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
) -> None:
    upstream(lambda _: httpx.Response(400, json={"error": "invalid_grant"}))

    response = await httpx_client.post(
        "/codex/token",
        data={"grant_type": AUTHORIZATION_CODE_GRANT_TYPE, "code": "used", "code_verifier": "v"},
    )

    assert response.status_code == 400
    assert response.json()["error"] == "invalid_grant"


async def test_device_authorization_follows_rfc_8628(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
) -> None:
    upstream(
        lambda _: httpx.Response(
            200, json={"device_auth_id": "dev_1", "user_code": "ABCD-EFGH", "interval": 7}
        )
    )

    response = await httpx_client.post("/codex/device_authorization")

    assert response.status_code == 200
    body = response.json()
    assert body["user_code"] == "ABCD-EFGH"
    assert body["verification_uri"] == codex.CODEX_DEVICE_VERIFICATION_URL
    assert body["interval"] == 7
    assert body["expires_in"] > 0
    # The device code is opaque to the client but round-trips upstream's handle.
    assert codex.decode_device_code(body["device_code"]) == ("dev_1", "ABCD-EFGH")


async def test_token_reports_authorization_pending(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
) -> None:
    upstream(lambda _: httpx.Response(403))

    response = await httpx_client.post(
        "/codex/token",
        data={
            "grant_type": DEVICE_CODE_GRANT_TYPE,
            "device_code": codex.encode_device_code(device_auth_id="dev_1", user_code="X"),
        },
    )

    assert response.status_code == 400
    assert response.json()["error"] == "authorization_pending"
    assert response.headers["cache-control"] == "no-store"


async def test_token_completes_the_device_grant(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/accounts/deviceauth/token":
            assert json.loads(request.content) == {"device_auth_id": "dev_1", "user_code": "X"}
            return httpx.Response(200, json={"authorization_code": "c", "code_verifier": "v"})
        assert request.url.path == "/oauth/token"
        return httpx.Response(200, json=TOKEN_JSON)

    upstream(handler)

    response = await httpx_client.post(
        "/codex/token",
        data={
            "grant_type": DEVICE_CODE_GRANT_TYPE,
            "device_code": codex.encode_device_code(device_auth_id="dev_1", user_code="X"),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "Bearer"
    assert body["access_token"] == ACCESS_TOKEN
    assert body["refresh_token"] == "rt_1"
    assert body["account_id"] == "acct_123"


async def test_token_refreshes(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/oauth/token"
        form = dict(pair.split("=", 1) for pair in request.content.decode().split("&"))
        assert form["grant_type"] == "refresh_token"
        assert form["refresh_token"] == "rt_old"
        return httpx.Response(200, json=TOKEN_JSON)

    upstream(handler)

    response = await httpx_client.post(
        "/codex/token",
        data={"grant_type": "refresh_token", "refresh_token": "rt_old"},
    )

    assert response.status_code == 200
    assert response.json()["refresh_token"] == "rt_1"


async def test_token_maps_a_rejected_refresh_to_invalid_grant(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
) -> None:
    upstream(lambda _: httpx.Response(400, json={"error": "invalid_grant"}))

    response = await httpx_client.post(
        "/codex/token",
        data={"grant_type": "refresh_token", "refresh_token": "stale"},
    )

    assert response.status_code == 400
    assert response.json()["error"] == "invalid_grant"


@pytest.mark.parametrize(
    "form,error",
    [
        pytest.param({"grant_type": "password"}, "unsupported_grant_type", id="unknown-grant"),
        pytest.param({"grant_type": DEVICE_CODE_GRANT_TYPE}, "invalid_request", id="no-code"),
        pytest.param(
            {"grant_type": DEVICE_CODE_GRANT_TYPE, "device_code": "not-ours"},
            "invalid_grant",
            id="foreign-code",
        ),
        pytest.param({"grant_type": "refresh_token"}, "invalid_request", id="no-refresh"),
        pytest.param(
            {"grant_type": AUTHORIZATION_CODE_GRANT_TYPE, "code": "c"},
            "invalid_request",
            id="no-verifier",
        ),
    ],
)
async def test_token_rejects_malformed_requests_without_calling_upstream(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
    form: dict[str, str],
    error: str,
) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise AssertionError("upstream must not be called")

    upstream(handler)

    response = await httpx_client.post("/codex/token", data=form)

    assert response.status_code == 400
    assert response.json()["error"] == error


async def test_models_takes_the_token_in_the_body(
    httpx_client: httpx.AsyncClient,
    upstream: Callable[[Callable[[httpx.Request], httpx.Response]], None],
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == f"Bearer {ACCESS_TOKEN}"
        return httpx.Response(200, json={"models": [{"slug": "gpt-5.4"}]})

    upstream(handler)

    response = await httpx_client.post("/codex/models", json={"access_token": ACCESS_TOKEN})

    assert response.status_code == 200
    assert response.json() == {"models": ["gpt-5.4"]}


async def test_routes_are_forbidden_when_agents_are_disabled(
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
) -> None:
    await app.state.system_settings.update_agent_assistant_enabled(
        AgentAssistantEnabledSetting(enabled=False)
    )

    response = await httpx_client.post("/codex/device_authorization")

    assert response.status_code == 403
