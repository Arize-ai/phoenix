from phoenix.evals.context import build_conversation_context, reconstruct_messages

CONVERSATION = [
    {"role": "system", "content": "You are a support bot."},
    {"role": "user", "content": "What's our refund window?"},
    {
        "role": "assistant",
        "content": "Let me check.",
        "tool_calls": [{"function": {"name": "lookup_policy", "arguments": '{"topic":"refund"}'}}],
    },
    {"role": "tool", "name": "lookup_policy", "content": "Refunds: 30 days from delivery."},
    {"role": "assistant", "content": "30 days from delivery."},
]


def test_selection_drops_system_role_by_default():
    result = build_conversation_context(CONVERSATION)
    assert "You are a support bot." not in result
    assert "User: What's our refund window?" in result


def test_selection_can_include_system_role():
    result = build_conversation_context(CONVERSATION, include_roles=("system", "user"))
    assert "System: You are a support bot." in result


def test_tool_calls_rendered_by_default_and_suppressible():
    with_calls = build_conversation_context(CONVERSATION)
    assert "[tool_call: lookup_policy(" in with_calls

    without_calls = build_conversation_context(CONVERSATION, include_tool_calls=False)
    assert "[tool_call:" not in without_calls


def test_tool_result_labeled_with_name():
    result = build_conversation_context(CONVERSATION)
    assert "Tool (lookup_policy): Refunds: 30 days from delivery." in result


def test_per_message_char_limit_truncates_middle():
    messages = [{"role": "user", "content": "A" * 500}]
    result = build_conversation_context(messages, per_message_char_limit=60)
    assert "...[truncated]..." in result
    assert len(result) <= 60


def test_max_turns_keeps_most_recent_and_marks_omission():
    result = build_conversation_context(CONVERSATION, max_turns=2)
    assert result.startswith("[... ")
    assert "omitted ...]" in result
    assert "30 days from delivery." in result
    assert "What's our refund window?" not in result


def test_token_budget_drops_oldest_and_marks_omission():
    result = build_conversation_context(CONVERSATION, max_context_tokens=8)
    assert "omitted ...]" in result
    assert "30 days from delivery." in result


def test_backstop_keeps_tail_and_marks_truncation():
    messages = [{"role": "user", "content": "X" * 400}]
    result = build_conversation_context(
        messages, per_message_char_limit=None, max_context_tokens=None, max_total_chars=50
    )
    assert result.startswith("[... earlier context truncated ...]")
    assert len(result) <= 50 + len("[... earlier context truncated ...]\n")


def test_empty_after_selection_returns_empty_string():
    assert build_conversation_context([{"role": "system", "content": "x"}]) == ""


def test_custom_token_counter_is_used():
    calls = []

    def counter(text):
        calls.append(text)
        return len(text)

    build_conversation_context(CONVERSATION, max_context_tokens=1_000_000, token_counter=counter)
    assert calls


def test_message_with_no_renderable_content_is_skipped():
    messages = [
        {"role": "assistant", "tool_calls": [{"function": {"name": "f", "arguments": "{}"}}]},
        {"role": "user", "content": "hi"},
    ]
    result = build_conversation_context(messages, include_tool_calls=False)
    assert result == "User: hi"


OI_MESSAGES = [
    {"message": {"role": "user", "content": "What's the refund window?"}},
    {
        "message": {
            "role": "assistant",
            "content": "Let me check.",
            "tool_calls": [
                {
                    "tool_call": {
                        "id": "a",
                        "function": {"name": "lookup_policy", "arguments": '{"topic":"refund"}'},
                    }
                }
            ],
        }
    },
]


def test_reconstruct_unwraps_message_and_role_content():
    result = reconstruct_messages(OI_MESSAGES)
    assert result[0] == {"role": "user", "content": "What's the refund window?"}


def test_reconstruct_flattens_nested_tool_calls():
    result = reconstruct_messages(OI_MESSAGES)
    assert result[1]["tool_calls"] == [
        {"function": {"name": "lookup_policy", "arguments": '{"topic":"refund"}'}}
    ]


def test_reconstruct_handles_legacy_function_call():
    oi = [{"message": {"role": "assistant", "function_call": {"name": "f", "arguments": "{}"}}}]
    result = reconstruct_messages(oi)
    assert result[0]["tool_calls"] == [{"function": {"name": "f", "arguments": "{}"}}]


def test_reconstruct_falls_back_to_message_contents():
    oi = [
        {
            "message": {
                "role": "assistant",
                "contents": [
                    {"message_content": {"type": "text", "text": "part one"}},
                    {"message_content": {"type": "text", "text": "part two"}},
                ],
            }
        }
    ]
    result = reconstruct_messages(oi)
    assert result[0]["content"] == "part one\n\npart two"


def test_reconstruct_defaults_missing_role_to_assistant():
    result = reconstruct_messages([{"message": {"content": "hi"}}])
    assert result[0]["role"] == "assistant"


def test_reconstruct_passthrough_flat_messages_is_idempotent():
    flat = [{"role": "user", "content": "hi"}]
    assert reconstruct_messages(flat) == flat


def test_reconstruct_none_returns_empty_list():
    assert reconstruct_messages(None) == []


def test_reconstruct_then_build_context():
    messages = reconstruct_messages(OI_MESSAGES)
    result = build_conversation_context(messages)
    assert "User: What's the refund window?" in result
    assert "[tool_call: lookup_policy(" in result
