# type: ignore
"""Tests for ``phoenix.evals.formatting`` (issue #15210).

Covers: normalization parity across the four physical message shapes, golden format
strings per ``tool_call_mode``, the configuration dials (roles, char/message budgets,
separator, truncation direction, tool-call ids), and edge cases.
"""

import pytest

from phoenix.evals.formatting import (
    OMITTED_LATER_MESSAGES_MARKER,
    OMITTED_MESSAGES_MARKER,
    TRUNCATION_MARKER,
    NormalizedMessage,
    ToolCall,
    format_messages,
    normalize_messages,
)

# --------------------------------------------------------------------------- #
# The same logical conversation expressed in each of the four supported shapes
# --------------------------------------------------------------------------- #
_OPENAI = [
    {"role": "user", "content": "hi"},
    {
        "role": "assistant",
        "tool_calls": [
            {
                "id": "c1",
                "type": "function",
                "function": {"name": "get_weather", "arguments": '{"city": "SF"}'},
            }
        ],
    },
    {"role": "tool", "tool_call_id": "c1", "content": "72F sunny"},
]

_DATASET = [
    {"role": "user", "content": "hi"},
    {
        "role": "assistant",
        "tool_calls": [{"function": {"name": "get_weather", "arguments": {"city": "SF"}}}],
    },
    {"role": "tool", "content": "72F sunny"},
]

_NESTED = [
    {"message": {"role": "user", "content": "hi"}},
    {
        "message": {
            "role": "assistant",
            "tool_calls": [
                {
                    "tool_call": {
                        "id": "c1",
                        "function": {"name": "get_weather", "arguments": '{"city": "SF"}'},
                    }
                }
            ],
        }
    },
    {"message": {"role": "tool", "tool_call_id": "c1", "content": "72F sunny"}},
]

_DOTTED = [
    {"message.role": "user", "message.content": "hi"},
    {
        "message.role": "assistant",
        "message.tool_calls": [
            {
                "tool_call.id": "c1",
                "tool_call.function.name": "get_weather",
                "tool_call.function.arguments": '{"city": "SF"}',
            }
        ],
    },
    {"message.role": "tool", "message.content": "72F sunny", "message.tool_call_id": "c1"},
]


# --------------------------------------------------------------------------- #
# Normalization parity
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("shape", [_OPENAI, _NESTED, _DOTTED], ids=["openai", "nested", "dotted"])
def test_shapes_normalize_identically(shape):
    """OpenAI, OTEL-nested, and dataframe dotted-key shapes normalize identically."""
    expected = [
        NormalizedMessage(role="user", content="hi"),
        NormalizedMessage(
            role="assistant",
            content="",
            tool_calls=[ToolCall(name="get_weather", arguments={"city": "SF"}, id="c1")],
        ),
        NormalizedMessage(role="tool", content="72F sunny", tool_call_id="c1"),
    ]
    assert normalize_messages(shape) == expected


def test_dataset_shape_normalizes_without_ids():
    """The dataset shape genuinely lacks tool-call/tool-result ids; args stay decoded."""
    result = normalize_messages(_DATASET)
    assert result[1].tool_calls == [ToolCall(name="get_weather", arguments={"city": "SF"}, id=None)]
    assert result[2] == NormalizedMessage(role="tool", content="72F sunny", tool_call_id=None)


def test_all_shapes_render_identically_in_full_mode():
    outputs = {format_messages(shape) for shape in (_OPENAI, _NESTED, _DOTTED)}
    assert len(outputs) == 1


def test_normalized_messages_pass_through():
    msgs = [NormalizedMessage(role="user", content="hi")]
    assert normalize_messages(msgs) == msgs


def test_role_aliases_canonicalized():
    msgs = [
        {"role": "human", "content": "a"},
        {"role": "ai", "content": "b"},
        {"role": "developer", "content": "c"},
        {"role": "function", "content": "d"},
    ]
    assert [m.role for m in normalize_messages(msgs)] == [
        "user",
        "assistant",
        "system",
        "tool",
    ]


def test_legacy_function_call_folded_into_tool_calls():
    msgs = [
        {
            "role": "assistant",
            "function_call": {"name": "search", "arguments": '{"q": "x"}'},
        }
    ]
    assert normalize_messages(msgs)[0].tool_calls == [
        ToolCall(name="search", arguments={"q": "x"}, id=None)
    ]


def test_multipart_content_joined():
    msgs = [
        {
            "role": "user",
            "contents": [
                {"type": "text", "text": "line one"},
                {"type": "text", "text": "line two"},
            ],
        }
    ]
    assert normalize_messages(msgs)[0].content == "line one\nline two"


# --------------------------------------------------------------------------- #
# Golden format strings — the canonical transcript from the issue, per mode
# --------------------------------------------------------------------------- #
_CANONICAL = [
    {"role": "system", "content": "You are a support agent. Today is 2026-07-27."},
    {"role": "user", "content": "What's our refund window?"},
    {
        "role": "assistant",
        "tool_calls": [
            {
                "id": "c1",
                "type": "function",
                "function": {
                    "name": "lookup_policy",
                    "arguments": '{"query": "refund window"}',
                },
            }
        ],
    },
    {"role": "tool", "tool_call_id": "c1", "content": "Refunds: 30 days from delivery."},
    {"role": "assistant", "content": "Refunds are accepted within 30 days of delivery."},
]


def test_golden_full():
    assert format_messages(_CANONICAL) == (
        "System: You are a support agent. Today is 2026-07-27.\n"
        "User: What's our refund window?\n"
        'Assistant: [tool_call] lookup_policy(query="refund window")\n'
        "Tool (lookup_policy): Refunds: 30 days from delivery.\n"
        "Assistant: Refunds are accepted within 30 days of delivery."
    )


def test_golden_names():
    assert format_messages(_CANONICAL, tool_call_mode="names") == (
        "System: You are a support agent. Today is 2026-07-27.\n"
        "User: What's our refund window?\n"
        "Assistant: [tool_call] lookup_policy(...)\n"
        "Assistant: Refunds are accepted within 30 days of delivery."
    )


def test_golden_skeleton():
    assert format_messages(_CANONICAL, tool_call_mode="skeleton") == (
        "System: You are a support agent. Today is 2026-07-27.\n"
        "User: What's our refund window?\n"
        'Assistant: [tool_call] lookup_policy(query="refund window")\n'
        "Tool (lookup_policy): ok (31 chars)\n"
        "Assistant: Refunds are accepted within 30 days of delivery."
    )


def test_golden_omit():
    assert format_messages(_CANONICAL, tool_call_mode="omit") == (
        "System: You are a support agent. Today is 2026-07-27.\n"
        "User: What's our refund window?\n"
        "Assistant: Refunds are accepted within 30 days of delivery."
    )


def test_skeleton_marks_errors():
    msgs = [
        {"role": "assistant", "tool_calls": [{"id": "c1", "function": {"name": "f"}}]},
        {"role": "tool", "tool_call_id": "c1", "content": "ERROR: rate_limit_exceeded"},
    ]
    out = format_messages(msgs, tool_call_mode="skeleton")
    assert "Tool (f): ERROR: ERROR: rate_limit_exceeded" in out


# --------------------------------------------------------------------------- #
# Configuration dials
# --------------------------------------------------------------------------- #
def test_include_roles():
    out = format_messages(_CANONICAL, include_roles=["user"])
    assert out == "User: What's our refund window?"


def test_exclude_roles():
    out = format_messages(_CANONICAL, exclude_roles=["system", "tool"])
    assert "System:" not in out
    assert "Tool (" not in out


def test_max_messages_keeps_last_and_marks_omission():
    msgs = [{"role": "user", "content": f"m{i}"} for i in range(5)]
    out = format_messages(msgs, max_messages=2)
    assert out == f"{OMITTED_MESSAGES_MARKER.format(n=3)}\nUser: m3\nUser: m4"


def test_max_messages_first_keeps_earliest():
    msgs = [{"role": "user", "content": f"m{i}"} for i in range(5)]
    out = format_messages(msgs, max_messages=2, truncation="first")
    assert out == f"User: m0\nUser: m1\n{OMITTED_LATER_MESSAGES_MARKER.format(n=3)}"


def test_max_chars_per_message_truncates_content():
    msgs = [{"role": "user", "content": "abcdefghij"}]
    out = format_messages(msgs, max_chars_per_message=4)
    assert out == f"User: abcd{TRUNCATION_MARKER}"


def test_max_chars_per_tool_result_truncates():
    msgs = [
        {"role": "assistant", "tool_calls": [{"id": "c1", "function": {"name": "f"}}]},
        {"role": "tool", "tool_call_id": "c1", "content": "0123456789"},
    ]
    out = format_messages(msgs, max_chars_per_tool_result=3)
    assert out.endswith(f"Tool (f): 012{TRUNCATION_MARKER}")


def test_max_chars_total_truncates():
    msgs = [{"role": "user", "content": "x" * 100}]
    out = format_messages(msgs, max_chars=10)
    assert out == "User: xxxx" + TRUNCATION_MARKER
    assert len(out) - len(TRUNCATION_MARKER) == 10


def test_custom_separator():
    msgs = [{"role": "user", "content": "a"}, {"role": "user", "content": "b"}]
    assert format_messages(msgs, separator=" | ") == "User: a | User: b"


def test_include_tool_call_ids():
    msgs = [
        {"role": "assistant", "tool_calls": [{"id": "call_42", "function": {"name": "f"}}]},
    ]
    out = format_messages(msgs, include_tool_call_ids=True)
    assert out == "Assistant: [tool_call] f() [id=call_42]"


# --------------------------------------------------------------------------- #
# Edge cases
# --------------------------------------------------------------------------- #
def test_empty_list():
    assert format_messages([]) == ""


def test_assistant_with_content_and_tool_calls():
    msgs = [
        {
            "role": "assistant",
            "content": "Let me check.",
            "tool_calls": [{"id": "c1", "function": {"name": "f", "arguments": {"a": 1}}}],
        }
    ]
    assert format_messages(msgs) == "Assistant: Let me check.\nAssistant: [tool_call] f(a=1)"


def test_dict_tool_result_serialized():
    msgs = [
        {"role": "assistant", "tool_calls": [{"id": "c1", "function": {"name": "f"}}]},
        {"role": "tool", "tool_call_id": "c1", "content": {"temperature": 58}},
    ]
    out = format_messages(msgs)
    assert out.endswith('Tool (f): {"temperature": 58}')


def test_unparseable_arguments_rendered_raw():
    msgs = [
        {"role": "assistant", "tool_calls": [{"function": {"name": "f", "arguments": "not json"}}]}
    ]
    assert format_messages(msgs) == "Assistant: [tool_call] f(not json)"


def test_unknown_role_preserved():
    msgs = [{"role": "moderator", "content": "hello"}]
    assert format_messages(msgs) == "Moderator: hello"


def test_invalid_tool_call_mode():
    with pytest.raises(ValueError):
        format_messages([], tool_call_mode="bogus")


def test_invalid_truncation():
    with pytest.raises(ValueError):
        format_messages([], truncation="middle")


def test_non_sequence_raises():
    with pytest.raises(TypeError):
        normalize_messages("not a list")


def test_mapping_without_span_keys_raises():
    with pytest.raises(TypeError):
        normalize_messages({"role": "user", "content": "hi"})


# --------------------------------------------------------------------------- #
# Flat LLM span attributes
# --------------------------------------------------------------------------- #
_SPAN_ATTRIBUTES = {
    "llm.model_name": "gpt-4o",
    "llm.input_messages.0.message.role": "user",
    "llm.input_messages.0.message.content": "weather in SF?",
    "llm.input_messages.1.message.role": "assistant",
    "llm.input_messages.1.message.tool_calls.0.tool_call.id": "c1",
    "llm.input_messages.1.message.tool_calls.0.tool_call.function.name": "get_weather",
    "llm.input_messages.1.message.tool_calls.0.tool_call.function.arguments": '{"city": "SF"}',
    "llm.input_messages.2.message.role": "tool",
    "llm.input_messages.2.message.content": "72F sunny",
    "llm.input_messages.2.message.tool_call_id": "c1",
    "llm.output_messages.0.message.role": "assistant",
    "llm.output_messages.0.message.content": "It's 72F and sunny.",
}


def test_flat_span_attributes_normalize():
    assert normalize_messages(_SPAN_ATTRIBUTES) == [
        NormalizedMessage(role="user", content="weather in SF?"),
        NormalizedMessage(
            role="assistant",
            tool_calls=[ToolCall(name="get_weather", arguments={"city": "SF"}, id="c1")],
        ),
        NormalizedMessage(role="tool", content="72F sunny", tool_call_id="c1"),
        NormalizedMessage(role="assistant", content="It's 72F and sunny."),
    ]


def test_flat_span_attributes_format():
    assert format_messages(_SPAN_ATTRIBUTES) == (
        "User: weather in SF?\n"
        'Assistant: [tool_call] get_weather(city="SF")\n'
        "Tool (get_weather): 72F sunny\n"
        "Assistant: It's 72F and sunny."
    )


def test_flat_span_attributes_only_input():
    attrs = {
        "llm.input_messages.0.message.role": "user",
        "llm.input_messages.0.message.content": "hi",
    }
    assert normalize_messages(attrs) == [NormalizedMessage(role="user", content="hi")]


# --------------------------------------------------------------------------- #
# Native provider-SDK message objects
# --------------------------------------------------------------------------- #
_ANTHROPIC = [
    {"role": "user", "content": "weather in SF?"},
    {
        "role": "assistant",
        "content": [
            {"type": "text", "text": "Let me check."},
            {"type": "tool_use", "id": "toolu_1", "name": "get_weather", "input": {"city": "SF"}},
        ],
    },
    {
        "role": "user",
        "content": [{"type": "tool_result", "tool_use_id": "toolu_1", "content": "72F sunny"}],
    },
    {"role": "assistant", "content": [{"type": "text", "text": "It's 72F and sunny."}]},
]


def test_native_anthropic_normalize():
    assert normalize_messages(_ANTHROPIC) == [
        NormalizedMessage(role="user", content="weather in SF?"),
        NormalizedMessage(
            role="assistant",
            content="Let me check.",
            tool_calls=[ToolCall(name="get_weather", arguments={"city": "SF"}, id="toolu_1")],
        ),
        NormalizedMessage(role="tool", content="72F sunny", tool_call_id="toolu_1"),
        NormalizedMessage(role="assistant", content="It's 72F and sunny."),
    ]


def test_native_anthropic_format_resolves_tool_name():
    assert format_messages(_ANTHROPIC) == (
        "User: weather in SF?\n"
        "Assistant: Let me check.\n"
        'Assistant: [tool_call] get_weather(city="SF")\n'
        "Tool (get_weather): 72F sunny\n"
        "Assistant: It's 72F and sunny."
    )


def test_native_anthropic_is_error_respected_in_skeleton():
    msgs = [
        {
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": "t1", "content": "boom", "is_error": True}
            ],
        }
    ]
    out = format_messages(msgs, tool_call_mode="skeleton")
    assert out == "Tool: ERROR: boom (4 chars)"


def test_native_anthropic_string_content():
    msgs = [{"role": "assistant", "content": "plain text"}]
    assert normalize_messages(msgs) == [NormalizedMessage(role="assistant", content="plain text")]


_GEMINI = [
    {"role": "user", "parts": [{"text": "weather in SF?"}]},
    {"role": "model", "parts": [{"functionCall": {"name": "get_weather", "args": {"city": "SF"}}}]},
    {
        "role": "user",
        "parts": [{"functionResponse": {"name": "get_weather", "response": {"tempF": 72}}}],
    },
    {"role": "model", "parts": [{"text": "It's 72F."}]},
]


def test_native_gemini_normalize():
    assert normalize_messages(_GEMINI) == [
        NormalizedMessage(role="user", content="weather in SF?"),
        NormalizedMessage(
            role="assistant",
            tool_calls=[ToolCall(name="get_weather", arguments={"city": "SF"}, id=None)],
        ),
        NormalizedMessage(role="tool", content='{"tempF": 72}', name="get_weather"),
        NormalizedMessage(role="assistant", content="It's 72F."),
    ]


def test_native_gemini_format():
    assert format_messages(_GEMINI) == (
        "User: weather in SF?\n"
        'Assistant: [tool_call] get_weather(city="SF")\n'
        'Tool (get_weather): {"tempF": 72}\n'
        "Assistant: It's 72F."
    )
