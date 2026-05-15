"""Unit tests for phoenix.trace.gen_ai.conversion."""

import json
from typing import Any

import pytest
from openinference.semconv.trace import (
    DocumentAttributes,
    ImageAttributes,
    MessageAttributes,
    MessageContentAttributes,
    OpenInferenceLLMProviderValues,
    OpenInferenceLLMSystemValues,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)
from opentelemetry.semconv._incubating.attributes import gen_ai_attributes as gen_ai
from opentelemetry.util.types import AttributeValue

from phoenix.trace.gen_ai.conversion import (
    get_openinference_attributes,
    get_openinference_base_attributes,
    get_openinference_embedding_attributes,
    get_openinference_message_attributes,
    get_openinference_request_attributes,
    get_openinference_response_attributes,
    get_openinference_retrieval_attributes,
    get_openinference_tool_attributes,
    get_openinference_usage_attributes,
)

# semconv attribute keys not yet exposed by the OTel Python package as constants;
# pinned here only so tests stay readable.
_GEN_AI_REQUEST_STREAM = "gen_ai.request.stream"


def _as_json(value: AttributeValue) -> Any:
    """Narrow AttributeValue to str (every JSON-encoded attribute we read is one)."""
    assert isinstance(value, str)
    return json.loads(value)


# ---------------------------------------------------------------------------
# top-level entry point
# ---------------------------------------------------------------------------


def test_returns_empty_for_none() -> None:
    assert get_openinference_attributes(None) == {}


def test_returns_empty_for_empty_mapping() -> None:
    assert get_openinference_attributes({}) == {}


def test_returns_empty_when_no_gen_ai_keys_present() -> None:
    """Hot-path bail: spans with no gen_ai.* attrs (the vast majority — HTTP
    middleware, DB queries, etc.) skip the full conversion pipeline."""
    assert (
        get_openinference_attributes(
            {
                "http.method": "GET",
                "http.status_code": 200,
                "db.system": "postgresql",
                # Intentionally similar prefix but not gen_ai.*
                "genai.foo": "bar",
            }
        )
        == {}
    )


def test_full_chat_span_round_trip() -> None:
    """End-to-end: a representative chat span produces every expected attribute family."""
    attrs: dict[str, AttributeValue] = {
        gen_ai.GEN_AI_OPERATION_NAME: "chat",
        gen_ai.GEN_AI_PROVIDER_NAME: "openai",
        gen_ai.GEN_AI_REQUEST_MODEL: "gpt-4",
        gen_ai.GEN_AI_RESPONSE_MODEL: "gpt-4-0613",
        gen_ai.GEN_AI_RESPONSE_ID: "resp-123",
        gen_ai.GEN_AI_REQUEST_TEMPERATURE: 0.7,
        gen_ai.GEN_AI_USAGE_INPUT_TOKENS: 100,
        gen_ai.GEN_AI_USAGE_OUTPUT_TOKENS: 25,
        gen_ai.GEN_AI_RESPONSE_FINISH_REASONS: ("stop",),
        gen_ai.GEN_AI_INPUT_MESSAGES: json.dumps(
            [{"role": "user", "parts": [{"type": "text", "content": "Hi"}]}]
        ),
        gen_ai.GEN_AI_OUTPUT_MESSAGES: json.dumps(
            [
                {
                    "role": "assistant",
                    "finish_reason": "stop",
                    "parts": [{"type": "text", "content": "Hello!"}],
                }
            ]
        ),
    }
    out = get_openinference_attributes(attrs)
    assert out[SpanAttributes.OPENINFERENCE_SPAN_KIND] == OpenInferenceSpanKindValues.LLM.value
    assert out[SpanAttributes.LLM_PROVIDER] == OpenInferenceLLMProviderValues.OPENAI.value
    assert out[SpanAttributes.LLM_SYSTEM] == OpenInferenceLLMSystemValues.OPENAI.value
    assert out[SpanAttributes.LLM_MODEL_NAME] == "gpt-4"
    assert out[SpanAttributes.LLM_INVOCATION_PARAMETERS] == '{"temperature": 0.7}'
    assert out[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] == 100
    assert out[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] == 25
    assert out[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] == 125
    assert out[SpanAttributes.LLM_FINISH_REASON] == "stop"
    assert out[f"{SpanAttributes.LLM_INPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_CONTENT}"] == "Hi"
    assert (
        out[f"{SpanAttributes.LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_CONTENT}"]
        == "Hello!"
    )
    assert out[f"{SpanAttributes.LLM_OUTPUT_MESSAGES}.0.message.finish_reason"] == "stop"


# ---------------------------------------------------------------------------
# span kind inference (exercised through the public entry point)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "operation,expected_kind",
    [
        ("chat", OpenInferenceSpanKindValues.LLM.value),
        ("text_completion", OpenInferenceSpanKindValues.LLM.value),
        ("generate_content", OpenInferenceSpanKindValues.LLM.value),
        ("embeddings", OpenInferenceSpanKindValues.EMBEDDING.value),
        ("execute_tool", OpenInferenceSpanKindValues.TOOL.value),
        ("invoke_agent", OpenInferenceSpanKindValues.AGENT.value),
        ("create_agent", OpenInferenceSpanKindValues.AGENT.value),
    ],
)
def test_span_kind_from_operation_name(operation: str, expected_kind: str) -> None:
    out = get_openinference_attributes({gen_ai.GEN_AI_OPERATION_NAME: operation})
    assert out[SpanAttributes.OPENINFERENCE_SPAN_KIND] == expected_kind


def test_span_kind_unknown_operation_omits_kind() -> None:
    out = get_openinference_attributes({gen_ai.GEN_AI_OPERATION_NAME: "totally_made_up"})
    assert SpanAttributes.OPENINFERENCE_SPAN_KIND not in out


@pytest.mark.parametrize(
    "trigger_attr,trigger_value,expected_kind",
    [
        (gen_ai.GEN_AI_TOOL_CALL_ID, "call-1", OpenInferenceSpanKindValues.TOOL.value),
        (gen_ai.GEN_AI_TOOL_NAME, "search", OpenInferenceSpanKindValues.TOOL.value),
        (
            gen_ai.GEN_AI_EMBEDDINGS_DIMENSION_COUNT,
            1536,
            OpenInferenceSpanKindValues.EMBEDDING.value,
        ),
        (gen_ai.GEN_AI_REQUEST_MODEL, "gpt-4", OpenInferenceSpanKindValues.LLM.value),
        (gen_ai.GEN_AI_INPUT_MESSAGES, "[]", OpenInferenceSpanKindValues.LLM.value),
        (gen_ai.GEN_AI_OUTPUT_MESSAGES, "[]", OpenInferenceSpanKindValues.LLM.value),
    ],
)
def test_span_kind_inferred_when_operation_missing(
    trigger_attr: str, trigger_value: AttributeValue, expected_kind: str
) -> None:
    out = get_openinference_attributes({trigger_attr: trigger_value})
    assert out[SpanAttributes.OPENINFERENCE_SPAN_KIND] == expected_kind


# ---------------------------------------------------------------------------
# base attributes
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "provider,expected_provider,expected_system",
    [
        ("openai", "openai", "openai"),
        ("anthropic", "anthropic", "anthropic"),
        ("cohere", "cohere", "cohere"),
        ("mistral_ai", "mistralai", "mistralai"),
        ("gcp.vertex_ai", "google", "vertexai"),
        ("azure.ai.openai", "azure", "openai"),
        ("aws.bedrock", "aws", None),
        ("groq", "groq", None),
    ],
)
def test_provider_mapping(
    provider: str, expected_provider: str, expected_system: str | None
) -> None:
    out = get_openinference_base_attributes({gen_ai.GEN_AI_PROVIDER_NAME: provider})
    assert out[SpanAttributes.LLM_PROVIDER] == expected_provider
    if expected_system is None:
        assert SpanAttributes.LLM_SYSTEM not in out
    else:
        assert out[SpanAttributes.LLM_SYSTEM] == expected_system


def test_unknown_provider_passes_through_as_system() -> None:
    out = get_openinference_base_attributes({gen_ai.GEN_AI_PROVIDER_NAME: "my_custom_llm"})
    assert SpanAttributes.LLM_PROVIDER not in out
    assert out[SpanAttributes.LLM_SYSTEM] == "my_custom_llm"


def test_legacy_gen_ai_system_fallback_lowercased() -> None:
    out = get_openinference_base_attributes({gen_ai.GEN_AI_SYSTEM: "OpenAI"})
    assert out[SpanAttributes.LLM_PROVIDER] == OpenInferenceLLMProviderValues.OPENAI.value
    assert out[SpanAttributes.LLM_SYSTEM] == OpenInferenceLLMSystemValues.OPENAI.value


def test_no_provider_or_system_returns_empty() -> None:
    assert get_openinference_base_attributes({}) == {}


def test_conversation_id_maps_to_session_id() -> None:
    out = get_openinference_base_attributes({gen_ai.GEN_AI_CONVERSATION_ID: "conv-42"})
    assert out[SpanAttributes.SESSION_ID] == "conv-42"


# ---------------------------------------------------------------------------
# request attributes
# ---------------------------------------------------------------------------


def test_request_model_uses_llm_model_name_for_chat() -> None:
    out = get_openinference_request_attributes(
        {gen_ai.GEN_AI_REQUEST_MODEL: "gpt-4"}, span_kind=OpenInferenceSpanKindValues.LLM.value
    )
    assert out[SpanAttributes.LLM_MODEL_NAME] == "gpt-4"
    assert SpanAttributes.EMBEDDING_MODEL_NAME not in out


def test_request_model_uses_embedding_model_name_for_embeddings() -> None:
    out = get_openinference_request_attributes(
        {gen_ai.GEN_AI_REQUEST_MODEL: "text-embedding-3-small"},
        span_kind=OpenInferenceSpanKindValues.EMBEDDING.value,
    )
    assert out[SpanAttributes.EMBEDDING_MODEL_NAME] == "text-embedding-3-small"
    assert SpanAttributes.LLM_MODEL_NAME not in out


def test_invocation_parameters_collects_all_request_params() -> None:
    out = get_openinference_request_attributes(
        {
            gen_ai.GEN_AI_REQUEST_TEMPERATURE: 0.7,
            gen_ai.GEN_AI_REQUEST_TOP_P: 0.95,
            gen_ai.GEN_AI_REQUEST_TOP_K: 40,
            gen_ai.GEN_AI_REQUEST_MAX_TOKENS: 1024,
            gen_ai.GEN_AI_REQUEST_FREQUENCY_PENALTY: 0.1,
            gen_ai.GEN_AI_REQUEST_PRESENCE_PENALTY: 0.2,
            gen_ai.GEN_AI_REQUEST_SEED: 42,
            _GEN_AI_REQUEST_STREAM: True,
            gen_ai.GEN_AI_REQUEST_CHOICE_COUNT: 3,
        }
    )
    params = _as_json(out[SpanAttributes.LLM_INVOCATION_PARAMETERS])
    assert params == {
        "temperature": 0.7,
        "top_p": 0.95,
        "top_k": 40,
        "max_tokens": 1024,
        "frequency_penalty": 0.1,
        "presence_penalty": 0.2,
        "seed": 42,
        "stream": True,
        "n": 3,
    }


def test_invocation_parameters_stop_sequences_become_list() -> None:
    out = get_openinference_request_attributes(
        {gen_ai.GEN_AI_REQUEST_STOP_SEQUENCES: ("\n\n", "STOP")}
    )
    assert _as_json(out[SpanAttributes.LLM_INVOCATION_PARAMETERS])["stop"] == ["\n\n", "STOP"]


def test_encoding_format_singular_when_single_value() -> None:
    out = get_openinference_request_attributes({gen_ai.GEN_AI_REQUEST_ENCODING_FORMATS: ("float",)})
    assert _as_json(out[SpanAttributes.LLM_INVOCATION_PARAMETERS]) == {"encoding_format": "float"}


def test_encoding_format_plural_when_multiple() -> None:
    out = get_openinference_request_attributes(
        {gen_ai.GEN_AI_REQUEST_ENCODING_FORMATS: ("float", "base64")}
    )
    assert _as_json(out[SpanAttributes.LLM_INVOCATION_PARAMETERS]) == {
        "encoding_formats": ["float", "base64"]
    }


@pytest.mark.parametrize(
    "output_type,expected_response_format",
    [
        ("json", {"type": "json_object"}),
        ("text", {"type": "text"}),
    ],
)
def test_output_type_to_response_format(
    output_type: str, expected_response_format: dict[str, str]
) -> None:
    out = get_openinference_request_attributes({gen_ai.GEN_AI_OUTPUT_TYPE: output_type})
    params = _as_json(out[SpanAttributes.LLM_INVOCATION_PARAMETERS])
    assert params["response_format"] == expected_response_format


def test_invocation_parameters_omitted_when_empty() -> None:
    out = get_openinference_request_attributes({gen_ai.GEN_AI_REQUEST_MODEL: "gpt-4"})
    assert SpanAttributes.LLM_INVOCATION_PARAMETERS not in out


def test_embedding_invocation_parameters_key_for_embeddings() -> None:
    out = get_openinference_request_attributes(
        {gen_ai.GEN_AI_REQUEST_TEMPERATURE: 0.5},
        span_kind=OpenInferenceSpanKindValues.EMBEDDING.value,
    )
    assert SpanAttributes.EMBEDDING_INVOCATION_PARAMETERS in out
    assert SpanAttributes.LLM_INVOCATION_PARAMETERS not in out


# ---------------------------------------------------------------------------
# usage attributes
# ---------------------------------------------------------------------------


def test_usage_input_and_output_tokens_emit_total() -> None:
    out = get_openinference_usage_attributes(
        {gen_ai.GEN_AI_USAGE_INPUT_TOKENS: 100, gen_ai.GEN_AI_USAGE_OUTPUT_TOKENS: 25}
    )
    assert out[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] == 100
    assert out[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] == 25
    assert out[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] == 125


def test_usage_total_omitted_when_only_one_side_present() -> None:
    out = get_openinference_usage_attributes({gen_ai.GEN_AI_USAGE_INPUT_TOKENS: 100})
    assert out[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] == 100
    assert SpanAttributes.LLM_TOKEN_COUNT_TOTAL not in out


def test_usage_cache_token_counts() -> None:
    out = get_openinference_usage_attributes(
        {
            gen_ai.GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS: 50,
            gen_ai.GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS: 10,
        }
    )
    assert out[SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ] == 50
    assert out[SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE] == 10


@pytest.mark.parametrize("value,expected", [("100", 100), (100.0, 100), (True, None), ("x", None)])
def test_token_value_coercion(value: Any, expected: int | None) -> None:
    out = get_openinference_usage_attributes({gen_ai.GEN_AI_USAGE_INPUT_TOKENS: value})
    if expected is None:
        assert SpanAttributes.LLM_TOKEN_COUNT_PROMPT not in out
    else:
        assert out[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] == expected


# ---------------------------------------------------------------------------
# message attributes — input/output flattening
# ---------------------------------------------------------------------------


def _input_messages(messages: list[dict[str, Any]]) -> dict[str, AttributeValue]:
    return {gen_ai.GEN_AI_INPUT_MESSAGES: json.dumps(messages)}


def _output_messages(messages: list[dict[str, Any]]) -> dict[str, AttributeValue]:
    return {gen_ai.GEN_AI_OUTPUT_MESSAGES: json.dumps(messages)}


def test_single_text_part_collapses_to_message_content() -> None:
    out = get_openinference_message_attributes(
        _input_messages([{"role": "user", "parts": [{"type": "text", "content": "hello"}]}])
    )
    assert out[f"{SpanAttributes.LLM_INPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_ROLE}"] == "user"
    assert (
        out[f"{SpanAttributes.LLM_INPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_CONTENT}"] == "hello"
    )
    # No structured contents emitted for a single text part.
    assert not any(MessageAttributes.MESSAGE_CONTENTS in k for k in out)


def test_multiple_text_parts_emit_structured_contents() -> None:
    out = get_openinference_message_attributes(
        _input_messages(
            [
                {
                    "role": "user",
                    "parts": [
                        {"type": "text", "content": "first"},
                        {"type": "text", "content": "second"},
                    ],
                }
            ]
        )
    )
    base = f"{SpanAttributes.LLM_INPUT_MESSAGES}.0"
    contents = MessageAttributes.MESSAGE_CONTENTS
    text_type = MessageContentAttributes.MESSAGE_CONTENT_TYPE
    text_text = MessageContentAttributes.MESSAGE_CONTENT_TEXT
    assert out[f"{base}.{contents}.0.{text_type}"] == "text"
    assert out[f"{base}.{contents}.0.{text_text}"] == "first"
    assert out[f"{base}.{contents}.1.{text_type}"] == "text"
    assert out[f"{base}.{contents}.1.{text_text}"] == "second"


def test_text_plus_uri_image_emits_structured_contents() -> None:
    out = get_openinference_message_attributes(
        _input_messages(
            [
                {
                    "role": "user",
                    "parts": [
                        {"type": "text", "content": "Look at this:"},
                        {
                            "type": "uri",
                            "modality": "image",
                            "uri": "https://example.com/cat.png",
                        },
                    ],
                }
            ]
        )
    )
    base = f"{SpanAttributes.LLM_INPUT_MESSAGES}.0"
    contents = MessageAttributes.MESSAGE_CONTENTS
    image = MessageContentAttributes.MESSAGE_CONTENT_IMAGE
    assert out[f"{base}.{contents}.0.{MessageContentAttributes.MESSAGE_CONTENT_TYPE}"] == "text"
    assert out[f"{base}.{contents}.1.{MessageContentAttributes.MESSAGE_CONTENT_TYPE}"] == "image"
    assert (
        out[f"{base}.{contents}.1.{image}.{ImageAttributes.IMAGE_URL}"]
        == "https://example.com/cat.png"
    )


def test_blob_part_becomes_data_url() -> None:
    out = get_openinference_message_attributes(
        _input_messages(
            [
                {
                    "role": "user",
                    "parts": [
                        {
                            "type": "blob",
                            "mime_type": "image/png",
                            "modality": "image",
                            "content": "SGVsbG8=",
                        }
                    ],
                }
            ]
        )
    )
    base = f"{SpanAttributes.LLM_INPUT_MESSAGES}.0"
    image = MessageContentAttributes.MESSAGE_CONTENT_IMAGE
    assert (
        out[f"{base}.{MessageAttributes.MESSAGE_CONTENTS}.0.{image}.{ImageAttributes.IMAGE_URL}"]
        == "data:image/png;base64,SGVsbG8="
    )


def test_blob_part_without_mime_type_uses_octet_stream() -> None:
    out = get_openinference_message_attributes(
        _input_messages(
            [
                {
                    "role": "user",
                    "parts": [{"type": "blob", "modality": "image", "content": "AAAA"}],
                }
            ]
        )
    )
    image = MessageContentAttributes.MESSAGE_CONTENT_IMAGE
    base = f"{SpanAttributes.LLM_INPUT_MESSAGES}.0"
    assert (
        out[f"{base}.{MessageAttributes.MESSAGE_CONTENTS}.0.{image}.{ImageAttributes.IMAGE_URL}"]
        == "data:application/octet-stream;base64,AAAA"
    )


def test_tool_call_request_parts_emit_tool_calls() -> None:
    out = get_openinference_message_attributes(
        _output_messages(
            [
                {
                    "role": "assistant",
                    "finish_reason": "tool_call",
                    "parts": [
                        {
                            "type": "tool_call",
                            "id": "call_a",
                            "name": "get_weather",
                            "arguments": {"city": "SF"},
                        },
                        {
                            "type": "tool_call",
                            "id": "call_b",
                            "name": "get_time",
                            "arguments": {"tz": "PST"},
                        },
                    ],
                }
            ]
        )
    )
    base = f"{SpanAttributes.LLM_OUTPUT_MESSAGES}.0"
    calls = MessageAttributes.MESSAGE_TOOL_CALLS
    assert out[f"{base}.{calls}.0.{ToolCallAttributes.TOOL_CALL_ID}"] == "call_a"
    assert out[f"{base}.{calls}.0.{ToolCallAttributes.TOOL_CALL_FUNCTION_NAME}"] == "get_weather"
    assert (
        out[f"{base}.{calls}.0.{ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON}"]
        == '{"city": "SF"}'
    )
    assert out[f"{base}.{calls}.1.{ToolCallAttributes.TOOL_CALL_ID}"] == "call_b"
    assert out[f"{base}.{calls}.1.{ToolCallAttributes.TOOL_CALL_FUNCTION_NAME}"] == "get_time"


def test_tool_call_response_part_overrides_content() -> None:
    out = get_openinference_message_attributes(
        _input_messages(
            [
                {
                    "role": "tool",
                    "parts": [
                        {
                            "type": "tool_call_response",
                            "id": "call_a",
                            "response": {"temp_f": 65},
                        }
                    ],
                }
            ]
        )
    )
    base = f"{SpanAttributes.LLM_INPUT_MESSAGES}.0"
    assert out[f"{base}.{MessageAttributes.MESSAGE_TOOL_CALL_ID}"] == "call_a"
    assert out[f"{base}.{MessageAttributes.MESSAGE_CONTENT}"] == '{"temp_f": 65}'
    # No tool_calls or contents emitted; response short-circuits flatten.
    assert not any(MessageAttributes.MESSAGE_TOOL_CALLS in k for k in out)


def test_message_name_when_present() -> None:
    out = get_openinference_message_attributes(
        _input_messages(
            [{"role": "tool", "name": "weather_api", "parts": [{"type": "text", "content": "OK"}]}]
        )
    )
    base = f"{SpanAttributes.LLM_INPUT_MESSAGES}.0"
    assert out[f"{base}.{MessageAttributes.MESSAGE_NAME}"] == "weather_api"


def test_output_message_emits_finish_reason() -> None:
    out = get_openinference_message_attributes(
        _output_messages(
            [
                {
                    "role": "assistant",
                    "finish_reason": "stop",
                    "parts": [{"type": "text", "content": "Done."}],
                }
            ]
        )
    )
    base = f"{SpanAttributes.LLM_OUTPUT_MESSAGES}.0"
    assert out[f"{base}.message.finish_reason"] == "stop"


def test_input_message_does_not_emit_finish_reason() -> None:
    out = get_openinference_message_attributes(
        _input_messages([{"role": "user", "parts": [{"type": "text", "content": "Hi"}]}])
    )
    assert not any(".message.finish_reason" in k for k in out)


def test_empty_finish_reason_is_skipped() -> None:
    """Streaming chunks can carry an empty finish_reason mid-stream — render
    nothing rather than ``llm.{...}.message.finish_reason = ""``."""
    out = get_openinference_message_attributes(
        _output_messages(
            [
                {
                    "role": "assistant",
                    "finish_reason": "",
                    "parts": [{"type": "text", "content": "Silver orb in sky,"}],
                }
            ]
        )
    )
    assert not any(".message.finish_reason" in k for k in out)
    base = f"{SpanAttributes.LLM_OUTPUT_MESSAGES}.0"
    assert out[f"{base}.{MessageAttributes.MESSAGE_CONTENT}"] == "Silver orb in sky,"


def test_one_malformed_message_drops_the_whole_payload() -> None:
    """MVP behavior: model_validate_json validates the entire list in one shot, so
    a single bad item drops every message in the payload."""
    out = get_openinference_message_attributes(
        _input_messages(
            [
                {"role": "user", "parts": [{"type": "text", "content": "first"}]},
                {"role": "user"},  # missing required `parts` -> entire list dropped
                {"role": "user", "parts": [{"type": "text", "content": "third"}]},
            ]
        )
    )
    assert out == {}


def test_output_message_missing_finish_reason_is_dropped() -> None:
    """OutputMessage.finish_reason is required by the spec; messages without it
    fail validation and are skipped entirely (documented behavior change)."""
    out = get_openinference_message_attributes(
        _output_messages(
            [{"role": "assistant", "parts": [{"type": "text", "content": "incomplete"}]}]
        )
    )
    assert out == {}


def test_unparseable_messages_attribute_returns_empty() -> None:
    assert get_openinference_message_attributes({gen_ai.GEN_AI_INPUT_MESSAGES: "not json"}) == {}


def test_messages_attribute_missing_returns_empty() -> None:
    assert get_openinference_message_attributes({}) == {}


def _system_instructions(parts: list[dict[str, Any]]) -> dict[str, AttributeValue]:
    return {gen_ai.GEN_AI_SYSTEM_INSTRUCTIONS: json.dumps(parts)}


def test_system_instructions_become_synthetic_input_message_at_index_0() -> None:
    out = get_openinference_message_attributes(
        _system_instructions([{"type": "text", "content": "You are helpful."}])
    )
    base = f"{SpanAttributes.LLM_INPUT_MESSAGES}.0"
    assert out[f"{base}.{MessageAttributes.MESSAGE_ROLE}"] == "system"
    assert out[f"{base}.{MessageAttributes.MESSAGE_CONTENT}"] == "You are helpful."


def test_system_instructions_shift_input_messages_indices() -> None:
    """When both attributes are present, the system message goes to .0 and
    user/assistant turns from gen_ai.input.messages shift to .1, .2, ..."""
    out = get_openinference_message_attributes(
        {
            **_system_instructions([{"type": "text", "content": "Be terse."}]),
            **_input_messages(
                [
                    {"role": "user", "parts": [{"type": "text", "content": "Hi"}]},
                    {"role": "assistant", "parts": [{"type": "text", "content": "Hello."}]},
                ]
            ),
        }
    )
    prefix = SpanAttributes.LLM_INPUT_MESSAGES
    role = MessageAttributes.MESSAGE_ROLE
    content = MessageAttributes.MESSAGE_CONTENT
    assert out[f"{prefix}.0.{role}"] == "system"
    assert out[f"{prefix}.0.{content}"] == "Be terse."
    assert out[f"{prefix}.1.{role}"] == "user"
    assert out[f"{prefix}.1.{content}"] == "Hi"
    assert out[f"{prefix}.2.{role}"] == "assistant"
    assert out[f"{prefix}.2.{content}"] == "Hello."


def test_system_instructions_multipart_emits_structured_contents() -> None:
    """A system_instructions list with text + image parts uses the same
    structured-contents flattening as any multimodal message."""
    out = get_openinference_message_attributes(
        _system_instructions(
            [
                {"type": "text", "content": "Read this:"},
                {"type": "uri", "modality": "image", "uri": "https://example.com/policy.png"},
            ]
        )
    )
    base = f"{SpanAttributes.LLM_INPUT_MESSAGES}.0"
    contents = MessageAttributes.MESSAGE_CONTENTS
    image = MessageContentAttributes.MESSAGE_CONTENT_IMAGE
    assert out[f"{base}.{MessageAttributes.MESSAGE_ROLE}"] == "system"
    assert out[f"{base}.{contents}.0.{MessageContentAttributes.MESSAGE_CONTENT_TYPE}"] == "text"
    assert out[f"{base}.{contents}.1.{MessageContentAttributes.MESSAGE_CONTENT_TYPE}"] == "image"
    assert (
        out[f"{base}.{contents}.1.{image}.{ImageAttributes.IMAGE_URL}"]
        == "https://example.com/policy.png"
    )


def test_malformed_system_instructions_dropped_input_messages_keep_index_0() -> None:
    """If gen_ai.system_instructions fails validation, the synthetic system
    message is dropped and gen_ai.input.messages keep their original indices."""
    out = get_openinference_message_attributes(
        {
            # No `type` field -> fails every union variant (even GenericPart needs `type`).
            gen_ai.GEN_AI_SYSTEM_INSTRUCTIONS: json.dumps([{"foo": "bar"}]),
            **_input_messages([{"role": "user", "parts": [{"type": "text", "content": "Hi"}]}]),
        }
    )
    prefix = SpanAttributes.LLM_INPUT_MESSAGES
    assert out[f"{prefix}.0.{MessageAttributes.MESSAGE_ROLE}"] == "user"
    assert out[f"{prefix}.0.{MessageAttributes.MESSAGE_CONTENT}"] == "Hi"


def test_system_instructions_alone_returns_only_system_message() -> None:
    out = get_openinference_message_attributes(
        _system_instructions([{"type": "text", "content": "policy"}])
    )
    keys = sorted(out.keys())
    prefix = SpanAttributes.LLM_INPUT_MESSAGES
    assert keys == [
        f"{prefix}.0.{MessageAttributes.MESSAGE_CONTENT}",
        f"{prefix}.0.{MessageAttributes.MESSAGE_ROLE}",
    ]


# ---------------------------------------------------------------------------
# response attributes
# ---------------------------------------------------------------------------


def test_single_finish_reason_string() -> None:
    out = get_openinference_response_attributes({gen_ai.GEN_AI_RESPONSE_FINISH_REASONS: ("stop",)})
    assert out[SpanAttributes.LLM_FINISH_REASON] == "stop"


def test_multiple_finish_reasons_tuple() -> None:
    out = get_openinference_response_attributes(
        {gen_ai.GEN_AI_RESPONSE_FINISH_REASONS: ("stop", "length")}
    )
    assert out[SpanAttributes.LLM_FINISH_REASON] == ("stop", "length")


def test_response_id_and_model_become_output_value_json() -> None:
    out = get_openinference_response_attributes(
        {
            gen_ai.GEN_AI_RESPONSE_ID: "resp-1",
            gen_ai.GEN_AI_RESPONSE_MODEL: "gpt-4-0613",
        }
    )
    assert _as_json(out[SpanAttributes.OUTPUT_VALUE]) == {
        "id": "resp-1",
        "model": "gpt-4-0613",
    }
    assert out[SpanAttributes.OUTPUT_MIME_TYPE] == OpenInferenceMimeTypeValues.JSON.value


def test_response_attributes_returns_empty_for_empty_input() -> None:
    assert get_openinference_response_attributes({}) == {}


# ---------------------------------------------------------------------------
# tool attributes
# ---------------------------------------------------------------------------


def _tool_definitions(defs: list[dict[str, Any]]) -> dict[str, AttributeValue]:
    return {gen_ai.GEN_AI_TOOL_DEFINITIONS: json.dumps(defs)}


def test_function_definition_emits_full_oi_schema() -> None:
    out = get_openinference_tool_attributes(
        _tool_definitions(
            [
                {
                    "type": "function",
                    "name": "get_weather",
                    "description": "Look up the weather.",
                    "parameters": {"type": "object", "properties": {"city": {"type": "string"}}},
                }
            ]
        )
    )
    schema = _as_json(out[f"{SpanAttributes.LLM_TOOLS}.0.{ToolAttributes.TOOL_JSON_SCHEMA}"])
    assert schema == {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Look up the weather.",
            "parameters": {"type": "object", "properties": {"city": {"type": "string"}}},
        },
    }


def test_generic_tool_definition_preserves_extra_description_and_parameters() -> None:
    out = get_openinference_tool_attributes(
        _tool_definitions(
            [
                {
                    "type": "extension",
                    "name": "browser_search",
                    "description": "Search the web.",
                    "parameters": {"type": "object"},
                }
            ]
        )
    )
    schema = _as_json(out[f"{SpanAttributes.LLM_TOOLS}.0.{ToolAttributes.TOOL_JSON_SCHEMA}"])
    assert schema == {
        "type": "extension",
        "function": {
            "name": "browser_search",
            "description": "Search the web.",
            "parameters": {"type": "object"},
        },
    }


def test_function_definition_without_description_or_parameters() -> None:
    out = get_openinference_tool_attributes(
        _tool_definitions([{"type": "function", "name": "ping"}])
    )
    schema = _as_json(out[f"{SpanAttributes.LLM_TOOLS}.0.{ToolAttributes.TOOL_JSON_SCHEMA}"])
    assert schema == {"type": "function", "function": {"name": "ping"}}


def test_tool_definition_missing_type_defaults_to_function() -> None:
    """Anthropic's instrumentor emits tool defs as ``[{"name": ..., "description": ...,
    "input_schema": ...}]`` with no ``type`` field. The OTel semconv requires it; we
    forgive the omission by defaulting to ``"function"`` so these defs surface as
    ``llm.tools`` instead of silently dropping."""
    out = get_openinference_tool_attributes(
        _tool_definitions(
            [
                {
                    "name": "get_weather",
                    "description": "Look up the weather.",
                    "parameters": {"type": "object", "properties": {"city": {"type": "string"}}},
                }
            ]
        )
    )
    schema = _as_json(out[f"{SpanAttributes.LLM_TOOLS}.0.{ToolAttributes.TOOL_JSON_SCHEMA}"])
    assert schema == {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Look up the weather.",
            "parameters": {"type": "object", "properties": {"city": {"type": "string"}}},
        },
    }


def test_tool_definition_with_only_name_defaults_to_function() -> None:
    """Anthropic's web_search server-side tool comes through as ``[{"name": "web_search"}]``
    — a sparse definition with no description or parameters. Default-to-function still
    surfaces it (better than dropping)."""
    out = get_openinference_tool_attributes(_tool_definitions([{"name": "web_search"}]))
    schema = _as_json(out[f"{SpanAttributes.LLM_TOOLS}.0.{ToolAttributes.TOOL_JSON_SCHEMA}"])
    assert schema == {"type": "function", "function": {"name": "web_search"}}


def test_one_malformed_tool_definition_drops_the_whole_payload() -> None:
    out = get_openinference_tool_attributes(
        _tool_definitions(
            [
                {"type": "function", "name": "first"},
                # ``name`` is required on both Function and Generic — even after the
                # missing-``type`` forgiveness, this is still invalid and drops the list.
                {"description": "no name"},
                {"type": "function", "name": "third"},
            ]
        )
    )
    assert not any(k.endswith(ToolAttributes.TOOL_JSON_SCHEMA) for k in out)


def test_tool_span_emits_tool_metadata() -> None:
    out = get_openinference_tool_attributes(
        {
            gen_ai.GEN_AI_TOOL_NAME: "get_weather",
            gen_ai.GEN_AI_TOOL_DESCRIPTION: "Looks up weather.",
            gen_ai.GEN_AI_TOOL_CALL_ID: "call_a",
        },
        span_kind=OpenInferenceSpanKindValues.TOOL.value,
    )
    assert out[SpanAttributes.TOOL_NAME] == "get_weather"
    assert out[SpanAttributes.TOOL_DESCRIPTION] == "Looks up weather."
    assert out[SpanAttributes.TOOL_ID] == "call_a"


def test_non_tool_span_does_not_emit_tool_metadata() -> None:
    out = get_openinference_tool_attributes(
        {gen_ai.GEN_AI_TOOL_NAME: "x", gen_ai.GEN_AI_TOOL_CALL_ID: "y"},
        span_kind=OpenInferenceSpanKindValues.LLM.value,
    )
    assert out == {}


def test_tool_call_arguments_dict_reserialized() -> None:
    out = get_openinference_tool_attributes(
        {gen_ai.GEN_AI_TOOL_CALL_ARGUMENTS: '{"city":"SF","unit":"F"}'},
        span_kind=OpenInferenceSpanKindValues.TOOL.value,
    )
    assert _as_json(out[SpanAttributes.TOOL_PARAMETERS]) == {"city": "SF", "unit": "F"}


def test_tool_call_arguments_non_json_string_passed_through() -> None:
    out = get_openinference_tool_attributes(
        {gen_ai.GEN_AI_TOOL_CALL_ARGUMENTS: "not-json"},
        span_kind=OpenInferenceSpanKindValues.TOOL.value,
    )
    assert out[SpanAttributes.TOOL_PARAMETERS] == "not-json"


def test_tool_call_result_json_marks_mime_type() -> None:
    out = get_openinference_tool_attributes(
        {gen_ai.GEN_AI_TOOL_CALL_RESULT: '{"ok":true}'},
        span_kind=OpenInferenceSpanKindValues.TOOL.value,
    )
    assert out[SpanAttributes.OUTPUT_VALUE] == '{"ok":true}'
    assert out[SpanAttributes.OUTPUT_MIME_TYPE] == OpenInferenceMimeTypeValues.JSON.value


def test_tool_call_result_plain_string_no_mime_type() -> None:
    out = get_openinference_tool_attributes(
        {gen_ai.GEN_AI_TOOL_CALL_RESULT: "hello"},
        span_kind=OpenInferenceSpanKindValues.TOOL.value,
    )
    assert out[SpanAttributes.OUTPUT_VALUE] == "hello"
    assert SpanAttributes.OUTPUT_MIME_TYPE not in out


# ---------------------------------------------------------------------------
# retrieval attributes
# ---------------------------------------------------------------------------


def test_retrieval_returns_empty_for_non_retriever_span() -> None:
    out = get_openinference_retrieval_attributes(
        {gen_ai.GEN_AI_RETRIEVAL_QUERY_TEXT: "hi"},
        span_kind=OpenInferenceSpanKindValues.LLM.value,
    )
    assert out == {}


def test_retrieval_query_text_becomes_input_value() -> None:
    out = get_openinference_retrieval_attributes(
        {gen_ai.GEN_AI_RETRIEVAL_QUERY_TEXT: "What is GenAI?"},
        span_kind=OpenInferenceSpanKindValues.RETRIEVER.value,
    )
    assert out[SpanAttributes.INPUT_VALUE] == "What is GenAI?"
    assert out[SpanAttributes.INPUT_MIME_TYPE] == OpenInferenceMimeTypeValues.TEXT.value


def test_retrieval_documents_with_extras() -> None:
    out = get_openinference_retrieval_attributes(
        {
            gen_ai.GEN_AI_RETRIEVAL_DOCUMENTS: json.dumps(
                [
                    {
                        "id": "doc-1",
                        "score": 0.9,
                        "content": "first",
                        "metadata": {"source": "wiki"},
                    },
                    {"id": "doc-2", "score": 0.5, "content": "second"},
                ]
            )
        },
        span_kind=OpenInferenceSpanKindValues.RETRIEVER.value,
    )
    base0 = f"{SpanAttributes.RETRIEVAL_DOCUMENTS}.0"
    base1 = f"{SpanAttributes.RETRIEVAL_DOCUMENTS}.1"
    assert out[f"{base0}.{DocumentAttributes.DOCUMENT_ID}"] == "doc-1"
    assert out[f"{base0}.{DocumentAttributes.DOCUMENT_SCORE}"] == 0.9
    assert out[f"{base0}.{DocumentAttributes.DOCUMENT_CONTENT}"] == "first"
    assert out[f"{base0}.{DocumentAttributes.DOCUMENT_METADATA}"] == '{"source": "wiki"}'
    assert out[f"{base1}.{DocumentAttributes.DOCUMENT_ID}"] == "doc-2"
    assert f"{base1}.{DocumentAttributes.DOCUMENT_METADATA}" not in out


def test_one_malformed_document_drops_the_whole_payload() -> None:
    out = get_openinference_retrieval_attributes(
        {
            gen_ai.GEN_AI_RETRIEVAL_DOCUMENTS: json.dumps(
                [
                    {"id": "doc-1", "score": 0.9},
                    {"id": "no_score"},  # missing required score -> drops every doc
                    {"id": "doc-3", "score": 0.7},
                ]
            )
        },
        span_kind=OpenInferenceSpanKindValues.RETRIEVER.value,
    )
    assert not any(k.endswith(DocumentAttributes.DOCUMENT_SCORE) for k in out)


def test_retrieval_document_string_metadata_passed_through() -> None:
    out = get_openinference_retrieval_attributes(
        {
            gen_ai.GEN_AI_RETRIEVAL_DOCUMENTS: json.dumps(
                [{"id": "d", "score": 0.5, "metadata": "raw-string"}]
            )
        },
        span_kind=OpenInferenceSpanKindValues.RETRIEVER.value,
    )
    assert (
        out[f"{SpanAttributes.RETRIEVAL_DOCUMENTS}.0.{DocumentAttributes.DOCUMENT_METADATA}"]
        == "raw-string"
    )


# ---------------------------------------------------------------------------
# embedding attributes
# ---------------------------------------------------------------------------


def test_embedding_attributes_always_empty() -> None:
    """Dimensions can't be inverted to a vector, so this returns empty by design."""
    assert (
        get_openinference_embedding_attributes(
            {gen_ai.GEN_AI_EMBEDDINGS_DIMENSION_COUNT: 1536},
            span_kind=OpenInferenceSpanKindValues.EMBEDDING.value,
        )
        == {}
    )


def test_embedding_attributes_empty_for_non_embedding_span() -> None:
    assert (
        get_openinference_embedding_attributes(
            {gen_ai.GEN_AI_EMBEDDINGS_DIMENSION_COUNT: 1536},
            span_kind=OpenInferenceSpanKindValues.LLM.value,
        )
        == {}
    )
