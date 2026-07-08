# LLM Trace Tests

Tests for code that emits OpenInference spans against an LLM provider have two distinct concerns:

1. **Replay** — pin the LLM HTTP exchange so the test is deterministic and offline.
2. **Assertion** — verify that the right OpenInference span attributes get emitted.

Both have non-obvious gotchas. Follow the patterns below.

## VCR cassette workflow

Use [`tests/unit/vcr.py`](../../../../tests/unit/vcr.py) `CustomVCR` (record_mode `"once"`).

```python
with custom_vcr.use_cassette():
    response = await wrapped_model.request(...)
```

**Cassette path is derived from the test module name + test function name.** Renaming either orphans the cassette. Move both together, or delete and re-record.

### Recording vs. replay

- First run with no cassette → records by hitting the real provider. Requires a real API key in env.
- Subsequent runs → replay only. SDK still needs *some* API key to construct its client even though VCR intercepts the HTTP call.

**Always wire in the API-key fixture** so replay works without real credentials. `tests/unit/conftest.py` already exposes `openai_api_key` and `anthropic_api_key` fixtures that monkeypatch the env var to a fake value:

```python
@pytest.fixture
def wrapped_model(
    tracer_provider: TracerProvider,
    anthropic_api_key: str,
) -> OpenInferenceModelWrapper:
    return OpenInferenceModelWrapper(
        AnthropicModel(MODEL_NAME, provider=AnthropicProvider()),
        tracer_provider=tracer_provider,
    )
```

### Determinism

Free-form LLM output is impossible to assert exactly. Either:

1. Pin via cassette + don't assert on output text (only structure/role/etc.). Brittle if you re-record.
2. **Prefer**: prompt the model to repeat an exact phrase, set `temperature=0.0`, and assert exact equality. Survives re-recording.

```python
expected_output = "The capital of France is Paris."
messages = [ModelRequest(parts=[
    SystemPromptPart(content=f"Reply with exactly the following sentence and nothing else: {expected_output}"),
    UserPromptPart(content="What is the capital of France?"),
])]
settings = ModelSettings(temperature=0.0, max_tokens=32)
...
assert response_text == expected_output
```

### Re-recording when the request changes

When you change a prompt or any other field of the outgoing request, the cassette's recorded request body no longer matches and VCR will refuse the call. **Always delete the cassette and re-record** against the real provider — never hand-edit the YAML.

Hand-editing looks tempting (especially for streaming cassettes where you might want to split text across multiple `content_block_delta` events), but:

- It silently lets the cassette diverge from any real response shape the provider would actually return, which defeats the point of recording.
- Future schema changes from the provider will surprise you in production but pass in test.
- It's easy to introduce subtle inconsistencies (token counts, IDs, finish reasons) that mask bugs.

If a "Repeat exactly" prompt pinned the output text, re-recording is reproducible. That's the determinism mechanism — not editing the cassette.

## Span attribute assertions

### Use the `pop` + `assert not attributes` pattern

```python
attributes = dict(span.attributes or {})
assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
assert attributes.pop(LLM_PROVIDER) == PROVIDER_ANTHROPIC
# ... pop every attribute you expect ...
assert not attributes
```

This catches **unexpected** attributes too. Spot-checking a handful of keys lets bugs slip in (e.g. wrapper accidentally emits a sensitive field).

### Use OpenInference semantic-convention constants, not literal strings

```python
from openinference.semconv.trace import (
    MessageAttributes,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)

LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS
MESSAGE_TOOL_CALL_ID = MessageAttributes.MESSAGE_TOOL_CALL_ID
TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON

assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "user"
assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}") == prompt
```

Literal strings like `"message.role"` work but break silently if the spec moves. Constants are typo-safe.

### `assert isinstance(...)` over `cast(...)`

OTel attribute values are typed as `AttributeValue` (a union including `str`, `int`, sequences). `cast(str, ...)` lies to the type checker; `isinstance` is a real runtime check.

```python
inv_params = attributes.pop(LLM_INVOCATION_PARAMETERS)
assert isinstance(inv_params, str)
assert json.loads(inv_params) == dict(settings)
```

Works with the walrus operator when you just need the type-narrow + value:

```python
assert isinstance(prompt_tokens := attributes.pop(LLM_TOKEN_COUNT_PROMPT), int)
assert isinstance(completion_tokens := attributes.pop(LLM_TOKEN_COUNT_COMPLETION), int)
assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == prompt_tokens + completion_tokens
```

### Validate `input.value` / `output.value` JSON exhaustively

Don't just do `assert "messages" in parsed_input`. Assert the full key set and every field that's deterministic:

```python
parsed_input = json.loads(input_value)
assert set(parsed_input) == {"messages", "model_settings", "model_request_parameters"}
assert len(parsed_input["messages"]) == 1
assert parsed_input["messages"][0]["kind"] == "request"
assert parsed_input["model_settings"] == dict(settings)
```

`set(parsed_input) == {...}` catches extra fields too — same idea as `assert not attributes`.

### Streaming: assert event accumulation matches final text

If you yield partial text via streaming events, accumulate it during the loop and check it equals the final assembled text:

```python
event_text_chunks: list[str] = []
async for event in stream:
    if isinstance(event, PartStartEvent) and isinstance(event.part, TextPart):
        event_text_chunks.append(event.part.content)
    elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
        event_text_chunks.append(event.delta.content_delta)
final_response = stream.get()
streamed_text = "".join(p.content for p in final_response.parts if isinstance(p, TextPart))
assert "".join(event_text_chunks) == streamed_text == expected_output
```

Hand-craft the cassette to deliver text across **multiple** delta events; otherwise the multi-delta accumulation logic isn't exercised.

## Gotchas

- **Conditional attributes**. If the wrapper only sets `cache_read`/`cache_write` token attrs when the values are non-zero, and the cassette has zero, those keys *won't* appear. Don't add a defensive `attributes.pop(key, None)` "in case" — it hides real regressions. Either drive the keys to non-zero in the cassette and assert them, or accept they won't be present.
- **Where the SDK reads its API key**. Constructing `AnthropicModel(provider=AnthropicProvider())` reads `ANTHROPIC_API_KEY` at construction time. Wire the API-key fixture into the *fixture that builds the model*, not just into individual tests.
- **`record_mode="once"` doesn't auto-update**. Once a cassette exists, VCR will fail with a "request not found" error if the request changes — it won't silently re-record. Delete the cassette to re-record.
- **Constants block placement**. If many tests share a long block of `SpanAttributes.X = ...` aliases, push it to the bottom of the test file. Names referenced inside test/fixture bodies resolve at call time, so test ordering doesn't matter.
- **Don't construct test helpers around pydantic_ai types**. `ModelSettings(...)` and `ModelRequestParameters(...)` are direct constructors — no `_settings(...)` / `_empty_request_parameters(...)` wrapper helpers needed. Inline the construction in the test.

## Reference

A worked example covering all of the above: [`tests/unit/server/agents/pydantic_ai/test_openinference_model_wrapper.py`](../../../../tests/unit/server/agents/pydantic_ai/test_openinference_model_wrapper.py).
