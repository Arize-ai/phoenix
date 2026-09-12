# OTel GenAI conversion compatibility

`conversion.py` synthesizes OpenInference attributes from `gen_ai.*` attributes.
The models in `__generated__/models.py` target semantic conventions v1.41.1;
regenerate them with `make gen-otel-models`. Keep producer compatibility in the
conversion layer so regeneration does not erase it.

## Message processing path

1. Decode the JSON attribute once in `_normalize_and_validate_message_list`.
2. Normalize known legacy part fields in the decoded dictionaries.
3. Validate against the generated canonical model with `model_validate`.
4. Flatten typed parts into OpenInference message attributes.

Input and output messages have nested `parts` lists. System instructions are a
flat part list, projected into a synthetic system message before the input turns.
Normalization applies only to these three attributes. Retrieval documents retain
the direct JSON validation path; tool definitions have their own compatibility
step for a missing `type`.

## Patterns addressed

Older producer shapes (including the google-genai-style payload covered by the
regression tests) use blob `data` instead of `content` and omit `modality`.
Without normalization, these parts can fall through the model union to
`GenericPart`, which the flattener omits, causing attachments to disappear.
Compatibility is selected by field shape, without guessing a producer version.

For example, this legacy part:

```json
{"type": "blob", "mime_type": "image/png", "data": "SGVsbG8="}
```

is normalized to:

```json
{"type": "blob", "mime_type": "image/png", "content": "SGVsbG8=", "modality": "image"}
```

The resulting OpenInference image URL is `data:image/png;base64,SGVsbG8=`.
The base64 payload is preserved, not decoded and re-encoded.

| Pattern | Compatibility rule |
| --- | --- |
| Blob has `data` but no `content` | Move `data` to `content`. |
| Blob has both fields | Existing `content` wins, even if invalid. |
| Blob, URI, or file lacks `modality` | If `mime_type` is a string containing `/`, use the portion before `/`. |
| Explicit `modality` | Preserve it, even if invalid or inconsistent with MIME type. |
| Missing/unusable MIME type | Do not invent a modality; let validation decide. |
| Other part types | Leave unchanged. |

The generated modality type accepts arbitrary strings, so `application/pdf`
produces `application`, just as `image/png` produces `image`. This is field
compatibility, not MIME validation or a claim of renderer support.

## Failure behavior and limits

Invalid JSON, non-list roots, non-serialized attributes, or a model validation
error yield no messages for that attribute. A structurally invalid message can
reject the entire list. A part accepted as `GenericPart` is instead omitted by
the flattener while supported sibling parts survive. Normalization only changes
freshly decoded data; it does not mutate the source attributes.

URI and blob parts use OpenInference's image content surface, including non-image
MIME types; successful conversion does not guarantee that the UI can display that
media. File parts can be normalized and validated, but remain omitted because the
flattener has no mapping from provider file IDs to OpenInference content. Unknown
parts remain omitted. This does not add support for arbitrary future schema drift.

When extending compatibility, add a narrow shape rule before validation and
regression coverage in `tests/unit/trace/gen_ai/test_conversion.py`. Cover input,
output, and system shapes, canonical-field precedence, and malformed payloads;
keep `_flatten_message` concerned with validated models.
