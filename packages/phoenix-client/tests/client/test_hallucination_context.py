from phoenix.client.helpers.spans.hallucination import _row_to_eval_input

INPUT_MESSAGES = [
    {"message": {"role": "system", "content": "You are a support bot."}},
    {"message": {"role": "user", "content": "What's our refund window?"}},
    {
        "message": {
            "role": "assistant",
            "content": "Let me check.",
            "tool_calls": [
                {"tool_call": {"function": {"name": "lookup_policy", "arguments": "{}"}}}
            ],
        }
    },
    {"message": {"role": "tool", "content": "Refunds: 30 days."}},
    {"message": {"role": "user", "content": "And electronics?"}},
]
OUTPUT_MESSAGES = [{"message": {"role": "assistant", "content": "Electronics are 14 days."}}]


def test_holds_out_latest_user_turn_as_input():
    row = _row_to_eval_input(INPUT_MESSAGES, OUTPUT_MESSAGES, "fallback-in", "fallback-out")
    assert row["input"] == "And electronics?"
    assert "And electronics?" not in row["conversation"]


def test_output_comes_from_output_messages():
    row = _row_to_eval_input(INPUT_MESSAGES, OUTPUT_MESSAGES, "fallback-in", "fallback-out")
    assert row["output"] == "Electronics are 14 days."


def test_conversation_contains_prior_turns_and_tool_activity():
    row = _row_to_eval_input(INPUT_MESSAGES, OUTPUT_MESSAGES, "", "")
    assert "User: What's our refund window?" in row["conversation"]
    assert "Tool: Refunds: 30 days." in row["conversation"]
    assert "[tool_call: lookup_policy(" in row["conversation"]
    # system role is dropped by default
    assert "You are a support bot." not in row["conversation"]


def test_falls_back_to_scalar_values_when_messages_missing():
    row = _row_to_eval_input(None, None, "the question", "the answer")
    assert row == {"conversation": "", "input": "the question", "output": "the answer"}


def test_nan_like_messages_do_not_leak_into_output():
    row = _row_to_eval_input(float("nan"), float("nan"), "q", "a")
    assert row == {"conversation": "", "input": "q", "output": "a"}


def test_no_trailing_user_turn_uses_input_value_and_keeps_all_messages():
    messages = [
        {"message": {"role": "user", "content": "hi"}},
        {"message": {"role": "assistant", "content": "hello"}},
    ]
    row = _row_to_eval_input(messages, OUTPUT_MESSAGES, "explicit-question", "")
    assert row["input"] == "explicit-question"
    assert "User: hi" in row["conversation"]
    assert "Assistant: hello" in row["conversation"]


def test_context_options_are_forwarded():
    row = _row_to_eval_input(
        INPUT_MESSAGES,
        OUTPUT_MESSAGES,
        "",
        "",
        include_roles=("system", "user"),
    )
    assert "System: You are a support bot." in row["conversation"]
