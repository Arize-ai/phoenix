# Appendix: Error Types Across LLM Provider SDKs

This appendix documents how rate limit errors and other errors manifest across the various Python SDKs used by Phoenix for LLM inference. Understanding these patterns is critical for implementing robust error detection and retry logic in the background experiment runner.

## Overview

All modern LLM SDKs use a common pattern:
- **HTTP-based errors** map to specific exception classes
- **Rate limiting** is signaled via HTTP 429 (or provider-specific codes)
- **Retry-After headers** provide backoff guidance
- **Transient vs permanent errors** determine retry eligibility

## Provider-Specific Error Hierarchies

### OpenAI SDK (`openai`)

**Source**: Stainless-generated SDK

```
OpenAIError (base)
└── APIError
    ├── APIConnectionError
    │   └── APITimeoutError
    ├── APIStatusError
    │   ├── BadRequestError (400)
    │   ├── AuthenticationError (401)
    │   ├── PermissionDeniedError (403)
    │   ├── NotFoundError (404)
    │   ├── ConflictError (409)
    │   ├── UnprocessableEntityError (422)
    │   ├── RateLimitError (429)          ← RATE LIMIT
    │   └── InternalServerError (5xx)
    └── APIResponseValidationError
```

**Key Properties on `APIStatusError`**:
- `status_code: int` - HTTP status code
- `response: httpx.Response` - Full response object
- `request_id: str | None` - From `x-request-id` header
- `body: object | None` - Parsed JSON response body

**Detection Pattern**:
```python
from openai import RateLimitError

try:
    response = await client.chat.completions.create(...)
except RateLimitError as e:
    # e.status_code == 429
    # e.response.headers.get("retry-after") for backoff
    pass
```

---

### Anthropic SDK (`anthropic`)

**Source**: Stainless-generated SDK

```
AnthropicError (base)
└── APIError
    ├── APIConnectionError
    │   └── APITimeoutError
    ├── APIStatusError
    │   ├── BadRequestError (400)
    │   ├── AuthenticationError (401)
    │   ├── PermissionDeniedError (403)
    │   ├── NotFoundError (404)
    │   ├── ConflictError (409)
    │   ├── RequestTooLargeError (413)
    │   ├── UnprocessableEntityError (422)
    │   ├── RateLimitError (429)          ← RATE LIMIT
    │   ├── ServiceUnavailableError (503) ← TRANSIENT
    │   ├── DeadlineExceededError (504)   ← TRANSIENT
    │   ├── OverloadedError (529)         ← ANTHROPIC-SPECIFIC RATE LIMIT
    │   └── InternalServerError (5xx)
    └── APIResponseValidationError
```

**Anthropic-Specific Notes**:
- **HTTP 529 (Overloaded)**: Anthropic uses this non-standard code when their API is overloaded. Should be treated like rate limiting with longer backoff.
- **HTTP 503/504**: Transient errors that should be retried

**Detection Pattern**:
```python
from anthropic import RateLimitError, OverloadedError

try:
    response = await client.messages.create(...)
except (RateLimitError, OverloadedError) as e:
    # Both indicate capacity constraints
    pass
```

---

### Google GenAI SDK (`google-genai`)

**Source**: Stainless-generated SDK (newer versions)

```
GeminiNextGenAPIClientError (base)
└── APIError
    ├── APIConnectionError
    │   └── APITimeoutError
    ├── APIStatusError
    │   ├── BadRequestError (400)
    │   ├── AuthenticationError (401)
    │   ├── PermissionDeniedError (403)
    │   ├── NotFoundError (404)
    │   ├── ConflictError (409)
    │   ├── UnprocessableEntityError (422)
    │   ├── RateLimitError (429)          ← RATE LIMIT
    │   └── InternalServerError (5xx)
    └── APIResponseValidationError
```

**Legacy google.generativeai SDK**:
The older `google.generativeai` SDK uses a different hierarchy via `google.api_core.exceptions`:
- `ResourceExhausted` - Rate limit (maps to gRPC RESOURCE_EXHAUSTED)
- `ServiceUnavailable` - Transient

---

### AWS Bedrock via botocore

**Source**: botocore service definitions

AWS uses error **codes** rather than exception classes. Errors come as `botocore.exceptions.ClientError` with an error code in the response.

**Throttling Error Codes** (from `botocore/retries/standard.py`):
```python
_THROTTLED_ERROR_CODES = [
    'Throttling',
    'ThrottlingException',
    'ThrottledException',
    'RequestThrottledException',
    'TooManyRequestsException',
    'ProvisionedThroughputExceededException',
    'TransactionInProgressException',
    'RequestLimitExceeded',
    'BandwidthLimitExceeded',
    'LimitExceededException',
    'RequestThrottled',
    'SlowDown',
    'PriorRequestNotComplete',
    'EC2ThrottledException',
]
```

**Bedrock-Specific Errors** (from service model):
| Error | Description | Retryable |
|-------|-------------|-----------|
| `ThrottlingException` | Request rate exceeded | Yes (with backoff) |
| `ServiceQuotaExceededException` | Account quota exceeded | No (needs quota increase) |
| `ModelTimeoutException` | Model inference timeout | Maybe |
| `ModelErrorException` | Model returned error | No |
| `ModelNotReadyException` | Model warming up | Yes (with backoff) |
| `ServiceUnavailableException` | Service temporarily unavailable | Yes |
| `InternalServerException` | Internal error | Yes |

**Transient Error Codes** (from `botocore/retries/standard.py`):
```python
_TRANSIENT_ERROR_CODES = [
    'RequestTimeout',
    'RequestTimeoutException',
    'PriorRequestNotComplete',
]

_TRANSIENT_STATUS_CODES = [500, 502, 503, 504]
```

**Detection Pattern**:
```python
from botocore.exceptions import ClientError

try:
    response = await bedrock_client.invoke_model(...)
except ClientError as e:
    error_code = e.response.get('Error', {}).get('Code', '')
    if error_code in ['ThrottlingException', 'TooManyRequestsException']:
        # Rate limited
        pass
    elif error_code == 'ServiceQuotaExceededException':
        # Quota exceeded - not retryable
        pass
```

---

### Azure SDK (`azure-core`)

**Source**: Azure Core library

```
AzureError (base)
├── ServiceRequestError
│   └── ServiceRequestTimeoutError
├── ServiceResponseError
│   └── ServiceResponseTimeoutError
└── HttpResponseError
    ├── DecodeError
    │   └── IncompleteReadError
    ├── ResourceExistsError
    ├── ResourceNotFoundError
    ├── ClientAuthenticationError
    ├── ResourceModifiedError
    ├── ResourceNotModifiedError
    ├── TooManyRedirectsError
    └── ODataV4Error
```

**Azure OpenAI Specifics**:
Azure OpenAI wraps the OpenAI SDK, so errors come as `openai.RateLimitError` but may have Azure-specific headers.

**Detection Pattern**:
```python
from azure.core.exceptions import HttpResponseError

try:
    response = await client.complete(...)
except HttpResponseError as e:
    if e.status_code == 429:
        # Rate limited
        pass
```

---

## Retry-After Header Handling

All Stainless-generated SDKs (OpenAI, Anthropic, Google GenAI) implement identical `retry-after` parsing logic:

```python
def _parse_retry_after_header(response_headers):
    # 1. Try non-standard `retry-after-ms` header (milliseconds)
    retry_ms = response_headers.get("retry-after-ms")
    if retry_ms:
        return float(retry_ms) / 1000
    
    # 2. Try `retry-after` as seconds (integer or float)
    retry_header = response_headers.get("retry-after")
    try:
        return float(retry_header)
    except (TypeError, ValueError):
        pass
    
    # 3. Try `retry-after` as HTTP date
    retry_date = email.utils.parsedate_tz(retry_header)
    if retry_date:
        return email.utils.mktime_tz(retry_date) - time.time()
    
    return None
```

**SDK Behavior**:
- If `retry-after` is between 0-60 seconds, SDKs respect it
- Otherwise, exponential backoff is used
- Default max backoff is typically 20-60 seconds

---

## Error Classification Matrix

| Provider | Rate Limit | Transient (Retry) | Permanent (Abort) |
|----------|------------|-------------------|-------------------|
| **OpenAI** | `RateLimitError` (429) | `InternalServerError` (5xx), `APITimeoutError` | `BadRequestError`, `AuthenticationError`, `NotFoundError` |
| **Anthropic** | `RateLimitError` (429), `OverloadedError` (529) | `ServiceUnavailableError` (503), `DeadlineExceededError` (504), `InternalServerError` | `BadRequestError`, `AuthenticationError`, `NotFoundError` |
| **Google GenAI** | `RateLimitError` (429) | `InternalServerError` | `BadRequestError`, `AuthenticationError`, `NotFoundError` |
| **AWS Bedrock** | `ThrottlingException`, `TooManyRequestsException` | `ServiceUnavailableException`, `ModelNotReadyException`, 5xx | `ValidationException`, `AccessDeniedException`, `ModelErrorException` |
| **Azure** | HTTP 429 | `ServiceResponseError`, HTTP 5xx | `ClientAuthenticationError`, `ResourceNotFoundError` |

---

## Implementation Recommendations

### 1. Generic Rate Limit Detection

```python
def is_rate_limit_error(e: Exception) -> bool:
    """Detect rate limiting across all providers."""
    # Check exception class name
    error_name = type(e).__name__.lower()
    if 'ratelimit' in error_name or 'throttl' in error_name:
        return True
    
    # Check for Anthropic OverloadedError
    if 'overloaded' in error_name:
        return True
    
    # Check HTTP status code
    status_code = getattr(e, 'status_code', None)
    if status_code == 429:
        return True
    
    # Check botocore ClientError
    if hasattr(e, 'response'):
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code in BOTO_THROTTLE_CODES:
            return True
    
    return False
```

### 2. Generic Transient Error Detection

```python
def is_transient_error(e: Exception) -> bool:
    """Detect transient errors that should be retried."""
    # Timeouts are always transient
    if 'timeout' in type(e).__name__.lower():
        return True
    
    # Connection errors are transient
    if 'connection' in type(e).__name__.lower():
        return True
    
    # 5xx errors are typically transient
    status_code = getattr(e, 'status_code', None)
    if status_code and 500 <= status_code < 600:
        return True
    
    # Anthropic 529 (Overloaded)
    if status_code == 529:
        return True
    
    return False
```

### 3. Extract Retry-After Duration

```python
def get_retry_after_seconds(e: Exception) -> float | None:
    """Extract retry-after duration from error response."""
    response = getattr(e, 'response', None)
    if response is None:
        return None
    
    headers = getattr(response, 'headers', {})
    
    # Try retry-after-ms first
    if retry_ms := headers.get('retry-after-ms'):
        try:
            return float(retry_ms) / 1000
        except ValueError:
            pass
    
    # Try retry-after
    if retry_after := headers.get('retry-after'):
        try:
            return float(retry_after)
        except ValueError:
            pass
    
    return None
```

### 4. Exponential Backoff

When no `retry-after` header is provided:

```python
def calculate_backoff(attempt: int, base: float = 1.0, max_backoff: float = 60.0) -> float:
    """Calculate exponential backoff with jitter."""
    import random
    delay = min(base * (2 ** attempt), max_backoff)
    jitter = random.uniform(0, delay * 0.25)
    return delay + jitter
```

---

## Phoenix Integration

Phoenix currently uses a `PlaygroundRateLimiter` class that:
1. Accepts a provider-specific `rate_limit_error` class
2. Uses adaptive token bucket with 3 max retries
3. Coordinates across concurrent requests with locks

For the background experiment runner, we should:
1. Use the generic detection functions above for broader coverage
2. Extract `retry-after` headers when available
3. Implement per-experiment rate limiting (not global)
4. Distinguish between rate limits (retry with backoff) and permanent errors (abort task)

---

## References

- [OpenAI Python SDK - `_exceptions.py`](https://github.com/openai/openai-python/blob/722d3fffb82e9150a16da01e432b70d126ca5254/src/openai/_exceptions.py)
- [Anthropic Python SDK - `_exceptions.py`](https://github.com/anthropics/anthropic-sdk-python/blob/9b5ab24ba17bcd5e762e5a5fd69bb3c17b100aaa/src/anthropic/_exceptions.py)
- [Google GenAI SDK - `_exceptions.py`](https://github.com/googleapis/python-genai/blob/8d7c74d4579408714f4c9a5cc40d4772e670fae5/google/genai/_interactions/_exceptions.py)
- [botocore - `retries/standard.py`](https://github.com/boto/botocore/blob/52799594121c562b4e293bc10aef49b49b037864/botocore/retries/standard.py)
- [Azure Core - `exceptions.py`](https://github.com/Azure/azure-sdk-for-python/blob/f7ef11846bd79d4cb36349b2d917a7b92f1fc03a/sdk/core/azure-core/azure/core/exceptions.py)
