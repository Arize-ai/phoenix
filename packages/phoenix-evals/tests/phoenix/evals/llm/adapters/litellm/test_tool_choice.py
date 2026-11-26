"""``LiteLLMAdapter`` tool calling never forces a ``tool_choice`` on the Anthropic provider.

The mocked ``completion`` below rejects a forced ``tool_choice`` the way LiteLLM does for Claude
models that don't support it, so these tests fail if tool calling sends one to Anthropic.
"""

import json
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock

import pytest

pytest.importorskip("litellm")
from litellm import BadRequestError as LiteLLMBadRequestError

from phoenix.evals.llm.adapters.litellm.adapter import LiteLLMAdapter
from phoenix.evals.llm.adapters.litellm.client import LiteLLMClient
from phoenix.evals.llm.types import ObjectGenerationMethod

_SCHEMA = {"type": "object", "properties": {"label": {"type": "string"}}, "required": ["label"]}
_INSTRUCTION = "Respond by calling the `extract_structured_data` tool."


def _respond(**request: Any) -> MagicMock:
    if request["tool_choice"] != "auto":
        raise LiteLLMBadRequestError(
            message="claude-test does not support forced tool use",
            model="claude-test",
            llm_provider="anthropic",
        )
    tool_call = MagicMock()
    tool_call.function.arguments = json.dumps({"label": "a"})
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.tool_calls = [tool_call]
    return response


def _make_adapter(
    monkeypatch: pytest.MonkeyPatch, *, provider: str
) -> tuple[LiteLLMAdapter, MagicMock, AsyncMock]:
    adapter = LiteLLMAdapter(LiteLLMClient(provider=provider, model="claude-test"), "claude-test")
    completion_mock = MagicMock(side_effect=_respond)
    acompletion_mock = AsyncMock(side_effect=_respond)
    monkeypatch.setattr(adapter._litellm, "completion", completion_mock)
    monkeypatch.setattr(adapter._litellm, "acompletion", acompletion_mock)
    return adapter, completion_mock, acompletion_mock


def test_asks_anthropic_for_the_tool_call_at_the_end_of_the_system_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adapter, completion_mock, _ = _make_adapter(monkeypatch, provider="anthropic")
    system = {"role": "system", "content": "Be strict."}
    user = {"role": "user", "content": "q"}

    result = adapter.generate_object(
        [system, user], _SCHEMA, method=ObjectGenerationMethod.TOOL_CALLING
    )

    assert result == {"label": "a"}
    request: Dict[str, Any] = completion_mock.call_args.kwargs
    assert request["messages"] == [system, {"role": "system", "content": _INSTRUCTION}, user]


async def test_async_asks_anthropic_for_the_tool_call_without_a_system_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adapter, _, acompletion_mock = _make_adapter(monkeypatch, provider="anthropic")

    result = await adapter.async_generate_object(
        "q", _SCHEMA, method=ObjectGenerationMethod.TOOL_CALLING
    )

    assert result == {"label": "a"}
    assert acompletion_mock.call_args.kwargs["messages"] == [
        {"role": "system", "content": _INSTRUCTION},
        {"role": "user", "content": "q"},
    ]


def test_other_providers_still_force_the_tool(monkeypatch: pytest.MonkeyPatch) -> None:
    adapter, completion_mock, _ = _make_adapter(monkeypatch, provider="openai")
    completion_mock.side_effect = None
    completion_mock.return_value = _respond(tool_choice="auto")

    adapter.generate_object("q", _SCHEMA, method=ObjectGenerationMethod.TOOL_CALLING)

    request: Dict[str, Any] = completion_mock.call_args.kwargs
    assert request["tool_choice"] == {
        "type": "function",
        "function": {"name": "extract_structured_data"},
    }
    assert request["messages"] == [{"role": "user", "content": "q"}]
