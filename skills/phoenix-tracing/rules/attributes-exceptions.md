# Exception Attributes

Detailed reference for exception/error tracking.

## Exception Attributes

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `exception.type` | String | Exception class name | "ValueError" |
| `exception.message` | String | Error message | "Invalid input format" |
| `exception.stacktrace` | String | Full stack trace | "Traceback (most recent call last):\n..." |
| `exception.escaped` | Boolean | Whether exception propagated out of span | true |

## Example: Python Exception

```json
{
  "openinference.span.kind": "LLM",
  "status_code": "ERROR",
  "status_message": "API rate limit exceeded",
  "exception.type": "RateLimitError",
  "exception.message": "You exceeded your API rate limit. Please try again later.",
  "exception.stacktrace": "Traceback (most recent call last):\n  File \"app.py\", line 42, in call_llm\n    response = client.chat.completions.create(...)\n  File \"openai/api.py\", line 123, in create\n    raise RateLimitError(message)\nRateLimitError: You exceeded your API rate limit.",
  "exception.escaped": true
}
```

## Example: JavaScript Error

```json
{
  "openinference.span.kind": "TOOL",
  "status_code": "ERROR",
  "status_message": "Network request failed",
  "exception.type": "NetworkError",
  "exception.message": "fetch failed: ECONNREFUSED",
  "exception.stacktrace": "Error: fetch failed: ECONNREFUSED\n    at fetch (node:internal/deps/undici/undici:11576:11)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)",
  "exception.escaped": true
}
```

## Span Status

When exceptions occur, set span status:

| Field | Value | Description |
|-------|-------|-------------|
| `status_code` | "ERROR" | Indicates span failed |
| `status_message` | String | Brief error description |
