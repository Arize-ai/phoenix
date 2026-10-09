"""A tool result too large for the context window is withheld, not passed on.

An unfiltered span listing can run to millions of characters; passed to the model
it overflows the prompt and the turn ends with no answer.
"""

from __future__ import annotations

from pydantic_ai import Agent
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel

from phoenix.server.agents.capabilities import ToolResultLimitCapability
from phoenix.server.agents.capabilities.tool_result_limit import serialized_length


def _returned_to_model(size: int, *, max_chars: int) -> object:
    """Run one call of a tool returning ``size`` characters; return what the model saw."""
    seen: list[object] = []

    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        returns = [
            part.content
            for message in messages
            if isinstance(message, ModelRequest)
            for part in message.parts
            if isinstance(part, ToolReturnPart)
        ]
        if not returns:
            return ModelResponse(parts=[ToolCallPart(tool_name="payload", args={})])
        seen.extend(returns)
        return ModelResponse(parts=[TextPart(content="done")])

    agent = Agent(
        FunctionModel(model), capabilities=[ToolResultLimitCapability(max_chars=max_chars)]
    )

    @agent.tool_plain
    def payload() -> str:
        return "x" * size

    agent.run_sync("go")
    (returned,) = seen
    return returned


def test_a_result_within_the_limit_reaches_the_model() -> None:
    assert _returned_to_model(1_000, max_chars=1_000) == "x" * 1_000


def test_a_result_over_the_limit_is_replaced_by_a_notice() -> None:
    returned = _returned_to_model(1_001, max_chars=1_000)

    assert isinstance(returned, str)
    assert returned.startswith("The payload result was withheld: it is 1,001 characters")


def test_size_counts_characters_not_bytes() -> None:
    assert serialized_length({"text": "é" * 10}) == len('{"text":"' + "é" * 10 + '"}')


def test_an_unserializable_result_is_still_measured() -> None:
    class Unserializable:
        def __repr__(self) -> str:
            return "u" * 50

        def __str__(self) -> str:
            raise ValueError("no")

    assert serialized_length(Unserializable()) >= 50
