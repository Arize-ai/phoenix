# Universal Attributes

This document covers attributes that can be used on any span kind in OpenInference.

## Overview

These attributes can be used on **any span kind** to provide additional context, tracking, and metadata.

## Input/Output

| Attribute | Type | Description |
|-----------|------|-------------|
| `input.value` | String | Input to the operation (prompt, query, document) |
| `input.mime_type` | String | MIME type (e.g., "text/plain", "application/json") |
| `output.value` | String | Output from the operation (response, vector, result) |
| `output.mime_type` | String | MIME type of output |

**Example:**
```json
{
  "openinference.span.kind": "CHAIN",
  "input.value": "{\"question\": \"What is the weather?\"}",
  "input.mime_type": "application/json",
  "output.value": "{\"answer\": \"I don't have access to weather data.\"}",
  "output.mime_type": "application/json"
}
```

## Session and User Tracking

| Attribute | Type | Description |
|-----------|------|-------------|
| `session.id` | String | Session identifier for grouping related traces |
| `user.id` | String | User identifier for per-user analysis |

**Example:**
```json
{
  "openinference.span.kind": "LLM",
  "session.id": "session_abc123",
  "user.id": "user_xyz789"
}
```

**Phoenix Behavior:**
- Session and user IDs enable filtering traces by session/user in the UI
- Used for per-user analytics and debugging
- Stored as indexed columns for fast querying

## Metadata and Tags

| Attribute | Type | Description |
|-----------|------|-------------|
| `metadata` | Object | Arbitrary key-value metadata (flattened) |
| `tag.tags` | Array | List of tags (flattened as `tag.tags.0`, `tag.tags.1`, etc.) |

**Example:**
```json
{
  "openinference.span.kind": "LLM",
  "metadata.environment": "production",
  "metadata.model_version": "v2.1",
  "metadata.cost_center": "engineering",
  "tag.tags.0": "experiment_a",
  "tag.tags.1": "high_priority"
}
```

## Related Documentation

- The only required attribute for spans
- How nested data like metadata is stored
- [Attribute Conventions](rules/) - Detailed documentation for namespace-specific attributes
