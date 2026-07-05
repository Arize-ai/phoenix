from __future__ import annotations

from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)

from phoenix.server.agents.capabilities.context_policy import (
    TOOL_RESULT_CLEARED_TEMPLATE,
    ContextPolicyConfig,
    SummaryResult,
    apply_context_policy,
    apply_context_policy_async,
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
    assert parse_context_policy("p2:threshold=10,trailing_tokens=4,max_summary_tokens=3") == (
        ContextPolicyConfig(
            name="threshold_summary",
            threshold_tokens=10,
            trailing_tokens=4,
            max_summary_tokens=3,
        )
    )
    assert parse_context_policy("p3") == ContextPolicyConfig(
        name="noop_summary",
        threshold_tokens=40_000,
    )
    assert parse_context_policy("p4:trailing_tokens=12") == ContextPolicyConfig(
        name="naive_truncation",
        threshold_tokens=40_000,
        trailing_tokens=12,
    )
    assert parse_context_policy("p5:terms=needle-a|needle-b") == ContextPolicyConfig(
        name="oracle_focused",
        oracle_terms=("needle-a", "needle-b"),
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

    assert messages[0] in transformed


def test_threshold_summary_replaces_middle_with_summary_message() -> None:
    messages = [
        ModelRequest(parts=[UserPromptPart(content="first user goal")]),
        ModelResponse(parts=[TextPart(content="old assistant detail needle-a")]),
        *_history_with_tool_returns(2),
        ModelRequest(parts=[UserPromptPart(content="final prompt")]),
    ]

    transformed = apply_context_policy(
        messages,
        ContextPolicyConfig(
            name="threshold_summary",
            threshold_tokens=0,
            trailing_tokens=2,
            max_summary_tokens=20,
        ),
    )

    assert messages[0] in transformed
    summary_message = transformed[1]
    assert isinstance(summary_message, ModelRequest)
    summary_part = summary_message.parts[0]
    assert isinstance(summary_part, UserPromptPart)
    assert "conversation_summary" in str(summary_part.content)
    assert "old assistant detail needle-a" in str(summary_part.content)
    assert transformed[-1] is messages[-1]


def test_threshold_summary_drops_trailing_tool_results_without_matching_tool_calls() -> None:
    messages = [
        ModelRequest(parts=[UserPromptPart(content="first user goal")]),
        *_history_with_tool_returns(2),
        ModelRequest(parts=[UserPromptPart(content="final prompt")]),
    ]

    transformed = apply_context_policy(
        messages,
        ContextPolicyConfig(
            name="threshold_summary",
            threshold_tokens=0,
            trailing_tokens=1_000,
            max_summary_tokens=20,
        ),
    )

    assert messages[0] in transformed
    assert all(
        not any(isinstance(part, ToolReturnPart) for part in message.parts)
        for message in transformed
        if isinstance(message, ModelRequest)
    )
    assert transformed[-1] is messages[-1]


async def test_threshold_summary_async_uses_summarizer_and_returns_usage() -> None:
    messages: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="first user goal")]),
        ModelResponse(parts=[TextPart(content="old assistant detail needle-a")]),
        ModelRequest(parts=[UserPromptPart(content="final prompt")]),
    ]

    async def summarize(
        middle: list[ModelMessage],
        config: ContextPolicyConfig,
        model: object,
    ) -> SummaryResult:
        assert middle == [messages[1]]
        assert config.max_summary_tokens == 20
        assert getattr(model, "model_name") == "claude-test"
        return SummaryResult(
            text="summary kept needle-a",
            usage={
                "input_tokens": 9,
                "output_tokens": 3,
                "cache_read_tokens": 2,
                "cache_write_tokens": 4,
            },
        )

    applied = await apply_context_policy_async(
        messages,
        ContextPolicyConfig(
            name="threshold_summary",
            threshold_tokens=0,
            trailing_tokens=1,
            max_summary_tokens=20,
        ),
        model=type("FakeModel", (), {"system": "anthropic", "model_name": "claude-test"})(),
        summary_provider=summarize,
    )

    assert applied.usage == {
        "input_tokens": 9,
        "output_tokens": 3,
        "cache_read_tokens": 2,
        "cache_write_tokens": 4,
    }
    summary_message = applied.messages[1]
    assert isinstance(summary_message, ModelRequest)
    summary_part = summary_message.parts[0]
    assert isinstance(summary_part, UserPromptPart)
    assert "summary kept needle-a" in str(summary_part.content)


def test_noop_summary_uses_pinned_placeholder() -> None:
    messages: list[ModelRequest | ModelResponse] = [
        ModelRequest(parts=[UserPromptPart(content="first user goal")]),
        ModelResponse(parts=[TextPart(content="old assistant detail")]),
        ModelRequest(parts=[UserPromptPart(content="final prompt")]),
    ]

    transformed = apply_context_policy(
        messages,
        ContextPolicyConfig(name="noop_summary", threshold_tokens=0, trailing_tokens=1),
    )

    summary_message = transformed[1]
    assert isinstance(summary_message, ModelRequest)
    summary_part = summary_message.parts[0]
    assert isinstance(summary_part, UserPromptPart)
    assert summary_part.content == "[Earlier conversation history was removed to save context.]"


def test_naive_truncation_keeps_first_user_and_trailing_messages_without_summary() -> None:
    messages: list[ModelRequest | ModelResponse] = [
        ModelRequest(parts=[UserPromptPart(content="first user goal")]),
        ModelResponse(parts=[TextPart(content="old assistant detail")]),
        ModelRequest(parts=[UserPromptPart(content="final prompt")]),
    ]

    transformed = apply_context_policy(
        messages,
        ContextPolicyConfig(name="naive_truncation", threshold_tokens=0, trailing_tokens=1),
    )

    assert transformed == [messages[0], messages[-1]]


def test_oracle_focused_keeps_matching_messages_and_trailing_context() -> None:
    messages: list[ModelRequest | ModelResponse] = [
        ModelRequest(parts=[UserPromptPart(content="first user goal")]),
        ModelResponse(parts=[TextPart(content="irrelevant old detail")]),
        ModelResponse(parts=[TextPart(content="important needle-a detail")]),
        ModelRequest(parts=[UserPromptPart(content="final prompt")]),
    ]

    transformed = apply_context_policy(
        messages,
        ContextPolicyConfig(
            name="oracle_focused",
            trailing_tokens=1,
            oracle_terms=("needle-a",),
        ),
    )

    assert transformed[0] is messages[0]
    summary_message = transformed[1]
    assert isinstance(summary_message, ModelRequest)
    summary_part = summary_message.parts[0]
    assert isinstance(summary_part, UserPromptPart)
    assert "important needle-a detail" in str(summary_part.content)
    assert transformed[2] is messages[3]


def test_oracle_focused_does_not_keep_orphaned_tool_results() -> None:
    messages: list[ModelRequest | ModelResponse] = [
        ModelRequest(parts=[UserPromptPart(content="first user goal")]),
        *_history_with_tool_returns(2),
        ModelRequest(parts=[UserPromptPart(content="final prompt")]),
    ]

    transformed = apply_context_policy(
        messages,
        ContextPolicyConfig(
            name="oracle_focused",
            trailing_tokens=1_000,
            oracle_terms=("large output 0",),
        ),
    )

    assert all(
        not any(isinstance(part, ToolReturnPart) for part in message.parts)
        for message in transformed
        if isinstance(message, ModelRequest)
    )
    summary_message = transformed[1]
    assert isinstance(summary_message, ModelRequest)
    assert "large output 0" in str(summary_message.parts[0].content)
    assert transformed[-1] is messages[-1]
