# type: ignore
"""Tests for ``AnthropicAdapter.generate_object`` output validation (#12722).

Anthropic has no native structured-output method (tool calling only), so
there's nothing to fall back between -- these tests cover the output-content
validation added to the single tool-calling path: a correct result, a schema
violation, a refusal (``stop_reason == "refusal"``), and a truncated response
(``stop_reason == "max_tokens"``).

"Invalid JSON" isn't reachable here: the Anthropic SDK returns
``tool_use.input`` as an already-parsed dict, so there's no raw JSON text for
this adapter to parse (and fail to parse) itself.
"""

from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter
from phoenix.evals.llm.types import RefusalError, SchemaViolationError, TruncatedResponseError

SIMPLE_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "enum": ["yes", "no"]},
    },
    "required": ["label"],
}


def _make_adapter(model: str = "claude-3-sonnet") -> AnthropicAdapter:
    client = MagicMock()
    client.__module__ = "anthropic"
    client.__class__.__name__ = "Anthropic"
    client.messages.create = MagicMock()
    return AnthropicAdapter(client=client, model=model)


def _tool_use_response(args: dict, stop_reason: str = "tool_use") -> MagicMock:
    block = MagicMock()
    block.type = "tool_use"
    block.input = args
    response = MagicMock()
    response.content = [block]
    response.stop_reason = stop_reason
    return response


def _blocked_response(stop_reason: str) -> MagicMock:
    """A response with no tool_use block -- e.g. truncated before the tool
    call completed, or the model refused outright."""
    response = MagicMock()
    response.content = []
    response.stop_reason = stop_reason
    return response


def test_correctly_named_result() -> None:
    adapter = _make_adapter()
    adapter.client.messages.create.return_value = _tool_use_response({"label": "yes"})

    result = adapter.generate_object("test prompt", SIMPLE_SCHEMA)

    assert result == {"label": "yes"}


def test_schema_violation_raises_and_is_not_a_capability_mismatch() -> None:
    """The tool call succeeded but the args don't conform to the schema."""
    adapter = _make_adapter()
    adapter.client.messages.create.return_value = _tool_use_response({"label": "maybe"})

    with pytest.raises(SchemaViolationError):
        adapter.generate_object("test prompt", SIMPLE_SCHEMA)


def test_refusal_raises_refusal_error() -> None:
    adapter = _make_adapter()
    adapter.client.messages.create.return_value = _blocked_response("refusal")

    with pytest.raises(RefusalError):
        adapter.generate_object("test prompt", SIMPLE_SCHEMA)


def test_truncated_response_raises_truncated_error() -> None:
    adapter = _make_adapter()
    adapter.client.messages.create.return_value = _blocked_response("max_tokens")

    with pytest.raises(TruncatedResponseError):
        adapter.generate_object("test prompt", SIMPLE_SCHEMA)
