from __future__ import annotations

from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, ToolCallPart, ToolReturnPart

from phoenix.server.agents.capabilities.context_policy import (
    TOOL_RESULT_CLEARED_TEMPLATE,
    ContextPolicyConfig,
    apply_context_policy,
    parse_context_policy,
)


def _history_with_tool_returns(count: int) -> list[ModelRequest | ModelResponse]:
    messages: list[ModelRequest | ModelResponse] = []
    for index in range(count):
        tool_call_id = f"call-{index}"
        messages.append(
            ModelResponse(
                parts=[
                    ToolCallPart(
                        tool_name="bash",
                        args={"command": f"echo {index}"},
                        tool_call_id=tool_call_id,
                    )
                ]
            )
        )
        messages.append(
            ModelRequest(
                parts=[
                    ToolReturnPart(
                        tool_name="bash",
                        content=f"large output {index}",
                        tool_call_id=tool_call_id,
                    )
                ]
            )
        )
    return messages


def test_parse_context_policy_shorthands() -> None:
    assert parse_context_policy("p0") is None
    assert parse_context_policy("p1") == ContextPolicyConfig(name="clear_tool_uses")
    assert parse_context_policy("p1c") == ContextPolicyConfig(
        name="clear_tool_uses_continuous",
        threshold_tokens=0,
    )
    assert parse_context_policy("clear_tool_uses:k=2,threshold=10") == ContextPolicyConfig(
        name="clear_tool_uses",
        keep_recent_tool_returns=2,
        threshold_tokens=10,
    )


def test_apply_context_policy_clears_older_tool_returns() -> None:
    messages = _history_with_tool_returns(3)

    transformed = apply_context_policy(
        messages,
        ContextPolicyConfig(
            name="clear_tool_uses",
            keep_recent_tool_returns=1,
            threshold_tokens=0,
        ),
    )

    first_return = transformed[1].parts[0]
    second_return = transformed[3].parts[0]
    third_return = transformed[5].parts[0]
    assert isinstance(first_return, ToolReturnPart)
    assert isinstance(second_return, ToolReturnPart)
    assert isinstance(third_return, ToolReturnPart)
    assert first_return.content == TOOL_RESULT_CLEARED_TEMPLATE.format(
        tool_name="bash",
        n_chars=len("large output 0"),
    )
    assert second_return.content == TOOL_RESULT_CLEARED_TEMPLATE.format(
        tool_name="bash",
        n_chars=len("large output 1"),
    )
    assert third_return.content == "large output 2"


def test_apply_context_policy_leaves_messages_below_threshold() -> None:
    messages = _history_with_tool_returns(3)

    transformed = apply_context_policy(
        messages,
        ContextPolicyConfig(
            name="clear_tool_uses",
            keep_recent_tool_returns=1,
            threshold_tokens=1_000_000,
        ),
    )

    assert transformed is messages


def test_apply_context_policy_preserves_non_tool_messages() -> None:
    messages = [ModelResponse(parts=[TextPart(content="hello")]), *_history_with_tool_returns(2)]

    transformed = apply_context_policy(
        messages,
        ContextPolicyConfig(
            name="clear_tool_uses_continuous",
            keep_recent_tool_returns=0,
        ),
    )

    assert transformed[0] is messages[0]
