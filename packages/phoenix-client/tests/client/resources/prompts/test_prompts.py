from __future__ import annotations

import json

import httpx
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.constants.server_requirements import PATCH_PROMPT
from phoenix.client.resources.prompts import AsyncPrompts, Prompts
from phoenix.client.types import NOT_GIVEN


def _make_prompt(
    *,
    id: str = "prompt-1",
    name: str = "my-prompt",
    description: str | None = "hello",
    metadata: dict[str, object] | None = None,
) -> v1.Prompt:
    prompt: v1.Prompt = {"id": id, "name": name}
    if description is not None:
        prompt["description"] = description
    if metadata is not None:
        prompt["metadata"] = metadata
    return prompt


class _GuardSentinel(Exception):
    pass


class TestPromptsUpdate:
    def test_update_sends_description_and_metadata(self) -> None:
        updated = _make_prompt(
            description="updated",
            metadata={"team": "ml"},
        )

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PATCH"
            assert request.url.path == "/v1/prompts/my-prompt"
            assert json.loads(request.content) == {
                "description": "updated",
                "metadata": {"team": "ml"},
            }
            return httpx.Response(200, json={"data": updated})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Prompts(client).update(
            prompt_identifier="my-prompt",
            prompt_description="updated",
            prompt_metadata={"team": "ml"},
        )
        assert result == updated

    def test_update_omits_unset_fields(self) -> None:
        updated = _make_prompt(description="kept", metadata={"a": 1})

        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {"metadata": {"a": 1}}
            return httpx.Response(200, json={"data": updated})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Prompts(client).update(
            prompt_identifier="my-prompt",
            prompt_metadata={"a": 1},
        )
        assert result.get("metadata") == {"a": 1}

    def test_update_sends_null_description_to_clear(self) -> None:
        updated = _make_prompt(description=None)

        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {"description": None}
            return httpx.Response(200, json={"data": updated})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Prompts(client).update(
            prompt_identifier="my-prompt",
            prompt_description=None,
        )
        assert result == updated
        assert "description" not in result

    def test_update_treats_explicit_not_given_as_omission(self) -> None:
        updated = _make_prompt(description="kept", metadata={"a": 1})

        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {"metadata": {"a": 1}}
            return httpx.Response(200, json={"data": updated})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Prompts(client).update(
            prompt_identifier="my-prompt",
            prompt_description=NOT_GIVEN,
            prompt_metadata={"a": 1},
        )
        assert result == updated

    def test_update_requires_at_least_one_field(self) -> None:
        client = httpx.Client(
            transport=httpx.MockTransport(lambda r: pytest.fail("transport must not be reached")),
            base_url="http://test",
        )
        with pytest.raises(
            ValueError, match="At least one of prompt_description or prompt_metadata"
        ):
            Prompts(client).update(prompt_identifier="my-prompt")

    def test_update_maps_404_to_value_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, text="Prompt not found")

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        with pytest.raises(ValueError, match="Prompt not found: missing"):
            Prompts(client).update(
                prompt_identifier="missing",
                prompt_description="x",
            )

    def test_update_calls_guard_before_request(self) -> None:
        class _Guard:
            def require(self, requirement: object) -> None:
                if requirement is PATCH_PROMPT:
                    raise _GuardSentinel

        client = httpx.Client(
            transport=httpx.MockTransport(lambda r: pytest.fail("transport must not be reached")),
            base_url="http://test",
        )
        with pytest.raises(_GuardSentinel):
            Prompts(client, _guard=_Guard()).update(  # type: ignore[arg-type]
                prompt_identifier="my-prompt",
                prompt_description="x",
            )


class TestAsyncPromptsUpdate:
    @pytest.mark.asyncio
    async def test_update_sends_description_and_metadata(self) -> None:
        updated = _make_prompt(
            description="updated",
            metadata={"team": "ml"},
        )

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PATCH"
            assert request.url.path == "/v1/prompts/my-prompt"
            assert json.loads(request.content) == {
                "description": "updated",
                "metadata": {"team": "ml"},
            }
            return httpx.Response(200, json={"data": updated})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncPrompts(client).update(
            prompt_identifier="my-prompt",
            prompt_description="updated",
            prompt_metadata={"team": "ml"},
        )
        assert result == updated

    @pytest.mark.asyncio
    async def test_update_calls_guard_before_request(self) -> None:
        class _Guard:
            async def require(self, requirement: object) -> None:
                if requirement is PATCH_PROMPT:
                    raise _GuardSentinel

        client = httpx.AsyncClient(
            transport=httpx.MockTransport(lambda r: pytest.fail("transport must not be reached")),
            base_url="http://test",
        )
        with pytest.raises(_GuardSentinel):
            await AsyncPrompts(client, _guard=_Guard()).update(  # type: ignore[arg-type]
                prompt_identifier="my-prompt",
                prompt_description="x",
            )
