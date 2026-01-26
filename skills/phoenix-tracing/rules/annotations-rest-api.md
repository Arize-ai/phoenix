# REST API Annotation Patterns


## Endpoints

| Method | Endpoint | Purpose | Query Params |
|--------|----------|---------|--------------|
| POST | `/v1/span_annotations` | Create/update span annotations | `sync` (bool, default=false) |
| POST | `/v1/document_annotations` | Create/update document annotations | `sync` (bool, default=false) |
| POST | `/v1/trace_annotations` | Create/update trace annotations | `sync` (bool, default=false) |
| POST | `/v1/session_annotations` | Create/update session annotations | `sync` (bool, default=false) |
| GET | `/v1/projects/{project_id}/span_annotations` | Retrieve span annotations | `span_ids` (comma-separated) |
| GET | `/v1/projects/{project_id}/trace_annotations` | Retrieve trace annotations | `trace_ids` (comma-separated) |
| GET | `/v1/projects/{project_id}/session_annotations` | Retrieve session annotations | `session_ids` (comma-separated) |

**Query Parameter `sync`:** If true, waits for DB insertion and returns annotation IDs. If false (default), returns immediately with empty array.

## Request Format

All POST endpoints accept:

```json
{
  "data": [
    {
      "name": "annotation_name",
      "annotator_kind": "HUMAN",  // "HUMAN" (default), "LLM", or "CODE"
      "result": {
        "label": "string or null",      // At least one of label, score, or explanation required
        "score": "number or null",
        "explanation": "string or null"
      },
      "metadata": {},              // Optional
      "identifier": "optional_id"  // Optional (not for document annotations)
    }
  ]
}
```

## Span Annotations

**Endpoint:** `POST /v1/span_annotations`

```bash
curl -X POST "http://localhost:6006/v1/span_annotations?sync=true" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "span_id": "abc123",
      "name": "quality",
      "annotator_kind": "HUMAN",
      "result": {
        "label": "high_quality",
        "score": 0.95,
        "explanation": "Accurate and well-formatted"
      },
      "metadata": {"reviewer": "alice"},
      "identifier": "review_v1"
    }]
  }'
```

**Response (sync=true):** `{"data": [{"id": "annotation_id_123"}]}`
**Response (sync=false):** `{"data": []}`

**Batch:**
```bash
curl -X POST "http://localhost:6006/v1/span_annotations" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"span_id": "span1", "name": "sentiment", "annotator_kind": "LLM", "result": {"label": "positive", "score": 0.9}},
      {"span_id": "span2", "name": "sentiment", "annotator_kind": "LLM", "result": {"label": "negative", "score": 0.1}}
    ]
  }'
```

## Document Annotations

**Endpoint:** `POST /v1/document_annotations`

**Important:** Requires `document_position` (0-based integer). **No custom identifiers** - use empty string or omit.

```bash
curl -X POST "http://localhost:6006/v1/document_annotations?sync=true" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "span_id": "retriever_abc",
      "document_position": 0,
      "name": "relevance",
      "annotator_kind": "LLM",
      "result": {
        "label": "relevant",
        "score": 0.9,
        "explanation": "Directly answers query"
      },
      "metadata": {"model": "gpt-4"}
    }]
  }'
```

**Batch:**
```bash
curl -X POST "http://localhost:6006/v1/document_annotations" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"span_id": "span1", "document_position": 0, "name": "relevance", "annotator_kind": "LLM", "result": {"label": "relevant", "score": 0.95}},
      {"span_id": "span1", "document_position": 1, "name": "relevance", "annotator_kind": "LLM", "result": {"label": "irrelevant", "score": 0.1}}
    ]
  }'
```

## Trace Annotations

**Endpoint:** `POST /v1/trace_annotations`

```bash
curl -X POST "http://localhost:6006/v1/trace_annotations?sync=true" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "trace_id": "trace_xyz",
      "name": "correctness",
      "annotator_kind": "HUMAN",
      "result": {
        "label": "correct",
        "score": 1.0,
        "explanation": "Accurate and complete"
      },
      "metadata": {"reviewer": "bob"},
      "identifier": "final_review"
    }]
  }'
```

## Session Annotations

**Endpoint:** `POST /v1/session_annotations`

```bash
curl -X POST "http://localhost:6006/v1/session_annotations?sync=true" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "session_id": "session_123",
      "name": "user_satisfaction",
      "annotator_kind": "HUMAN",
      "result": {
        "label": "satisfied",
        "score": 0.85,
        "explanation": "Goal achieved"
      },
      "metadata": {"session_length": 5},
      "identifier": "end_review"
    }]
  }'
```

## Retrieving Annotations

```bash
# Span annotations
curl "http://localhost:6006/v1/projects/default/span_annotations?span_ids=span1,span2,span3"

# Trace annotations
curl "http://localhost:6006/v1/projects/default/trace_annotations?trace_ids=trace1,trace2"

# Session annotations
curl "http://localhost:6006/v1/projects/default/session_annotations?session_ids=session1,session2"
```

## RAG Pipeline Example

```json
{
  "data": [
    {
      "span_id": "retriever_span",
      "document_position": 0,
      "name": "relevance",
      "annotator_kind": "LLM",
      "result": {"label": "relevant", "score": 0.95}
    },
    {
      "span_id": "retriever_span",
      "document_position": 1,
      "name": "relevance",
      "annotator_kind": "LLM",
      "result": {"label": "relevant", "score": 0.80}
    }
  ]
}
```

Then annotate LLM span and trace with POST requests to `/v1/span_annotations` and `/v1/trace_annotations`.

## Error Responses

| Status | Meaning | Example |
|--------|---------|---------|
| 400 | Bad Request | `{"error": "Invalid request", "detail": "Missing required field: 'name'"}` |
| 404 | Not Found | `{"error": "Span not found", "detail": "Span with ID 'abc123' does not exist"}` |
| 422 | Unprocessable Entity | `{"error": "Validation error", "detail": "Document annotations do not support custom identifiers"}` |

## Field Constraints

**Result:** At least one of `label`, `score`, or `explanation` required.

**Annotator Kind:** "HUMAN" (default), "LLM", or "CODE"

**Identifier:**
- Span/Trace/Session: Optional, enables upsert by (name, entity_id, identifier)
- Document: Must be empty/omitted (no custom identifiers)

## Performance Tips

1. Use batch requests (array in `data` field)
2. Use async mode (`sync=false`) for fire-and-forget - much faster
3. Use sync mode (`sync=true`) only when you need annotation IDs
4. Include metadata for context

## Related Documentation

- Concepts and types
- Python client patterns
- TypeScript/JavaScript patterns
- Automated evaluation
- Querying annotations
