# pyright: reportPrivateUsage=false
import json

import httpx
import pytest

from phoenix.client.exceptions import PhoenixException
from phoenix.client.resources.prompts import AsyncPrompts, Prompts
from phoenix.client.types import PromptVersion
from phoenix.client.utils.server_requirements import (
    ParameterRequirement,
    RouteRequirement,
    ServerVersionGuard,
    Version,
    _check_version,
    _parse_version,
)

ROUTE = RouteRequirement(
    method="GET",
    path="/v1/sessions/{session_id}",
    min_server_version=Version(13, 5, 0),
)
PARAM = ParameterRequirement(
    parameter_name="trace_id",
    parameter_location="query",
    route="GET /v1/spans",
    min_server_version=Version(13, 9, 0),
)


class TestParseVersion:
    def test_valid(self) -> None:
        resp = httpx.Response(200, text="13.5.0")
        assert _parse_version(resp) == Version(13, 5, 0)

    def test_strips_whitespace(self) -> None:
        resp = httpx.Response(200, text="  1.2.3  \n")
        assert _parse_version(resp) == Version(1, 2, 3)

    def test_extra_parts_ignored(self) -> None:
        resp = httpx.Response(200, text="1.2.3.4")
        assert _parse_version(resp) == Version(1, 2, 3)

    @pytest.mark.parametrize("text", ["", "abc", "1.2"])
    def test_unparseable_text_raises(self, text: str) -> None:
        with pytest.raises(PhoenixException, match="could not be determined"):
            _parse_version(httpx.Response(200, text=text))

    def test_non_success_raises(self) -> None:
        with pytest.raises(PhoenixException, match="could not be determined"):
            _parse_version(httpx.Response(500, text="13.5.0"))


class TestCheckVersion:
    def test_passes_when_satisfied(self) -> None:
        _check_version(Version(13, 5, 0), ROUTE)
        _check_version(Version(14, 0, 0), ROUTE)

    def test_raises_when_too_old(self) -> None:
        with pytest.raises(PhoenixException, match="requires Phoenix >= 13.5.0"):
            _check_version(Version(13, 4, 99), ROUTE)

    def test_error_uses_route_str(self) -> None:
        with pytest.raises(PhoenixException, match=r"The GET /v1/sessions/\{session_id\}"):
            _check_version(Version(0, 0, 0), ROUTE)

    def test_error_uses_parameter_str(self) -> None:
        with pytest.raises(PhoenixException, match="'trace_id' query parameter"):
            _check_version(Version(0, 0, 0), PARAM)

    def test_description_override(self) -> None:
        req = RouteRequirement("GET", "/x", Version(1, 0, 0), description="Custom cap")
        with pytest.raises(PhoenixException, match="Custom cap requires"):
            _check_version(Version(0, 0, 0), req)


class TestServerVersionGuard:
    def test_caches_version_across_calls(self) -> None:
        call_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            return httpx.Response(200, text="14.0.0")

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        guard = ServerVersionGuard(client)
        guard.require(ROUTE)
        guard.require(ROUTE)
        assert call_count == 1

    def test_raises_on_old_server(self) -> None:
        client = httpx.Client(
            transport=httpx.MockTransport(lambda r: httpx.Response(200, text="12.0.0")),
            base_url="http://test",
        )
        guard = ServerVersionGuard(client)
        with pytest.raises(PhoenixException, match="requires Phoenix >= 13.5.0"):
            guard.require(ROUTE)


@pytest.mark.parametrize("is_async", [False, True])
@pytest.mark.parametrize("server_version", ["22.1.0", "22.2.0"])
@pytest.mark.asyncio
async def test_create_prompt_tags_checks_server_version_before_writes(
    is_async: bool, server_version: str
) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/arize_phoenix_version":
            return httpx.Response(200, text=server_version)
        assert request.method == "POST"
        assert request.url.path == "/v1/prompts"
        body = json.loads(request.content)
        assert body["tags"] == [{"name": "production"}]
        return httpx.Response(
            200, json={"data": {**body["version"], "id": "version-1", "created_at": "2026-11-24"}}
        )

    version = PromptVersion([{"role": "user", "content": "Hello"}], model_name="gpt-4o")
    transport = httpx.MockTransport(handler)
    if is_async:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
            prompts = AsyncPrompts(async_client)
            if server_version == "22.1.0":
                with pytest.raises(PhoenixException, match="requires Phoenix >= 22.2.0"):
                    await prompts.create(name="my-prompt", version=version, tags=["production"])
            else:
                for _ in range(2):
                    result = await prompts.create(
                        name="my-prompt", version=version, tags=["production", "production"]
                    )
                    assert result.id == "version-1"
    else:
        with httpx.Client(transport=transport, base_url="http://test") as client:
            sync_prompts = Prompts(client)
            if server_version == "22.1.0":
                with pytest.raises(PhoenixException, match="requires Phoenix >= 22.2.0"):
                    sync_prompts.create(name="my-prompt", version=version, tags=["production"])
            else:
                for _ in range(2):
                    result = sync_prompts.create(
                        name="my-prompt", version=version, tags=["production", "production"]
                    )
                    assert result.id == "version-1"

    assert [(request.method, request.url.path) for request in requests] == [
        ("GET", "/arize_phoenix_version"),
        *([("POST", "/v1/prompts")] * 2 if server_version == "22.2.0" else []),
    ]
