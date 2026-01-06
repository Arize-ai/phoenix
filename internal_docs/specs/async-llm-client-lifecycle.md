# Async LLM Client Lifecycle Management

## Overview

This document describes the rationale for implementing a unified async context manager pattern across all LLM provider clients in Phoenix's playground infrastructure. The design ensures proper HTTP connection lifecycle management and provides a consistent interface regardless of the underlying SDK.

## What Changed

| Provider | Before | After | Impact |
|----------|--------|-------|--------|
| **AWS Bedrock** | boto3 (blocking I/O) | aioboto3 (async I/O) | **Fixes event loop blocking** |
| OpenAI | Fresh client per request | Fresh client per request | No change |
| Azure OpenAI | Fresh client per request | Fresh client per request | No change |
| Anthropic | Fresh client per request | Fresh client per request | No change |
| Google GenAI | Fresh client per request | Fresh client per request | No change |

**Key insight**: All providers already created fresh clients per request, so they already incurred connection overhead (~20-250ms per request). This PR does not introduce new overhead for non-Bedrock providers—it only fixes Bedrock's blocking behavior.

The "unified factory pattern" formalizes the existing fresh-client pattern with explicit async context managers, ensuring consistent resource cleanup across all providers.

## Problem Statement

Phoenix's playground feature supports multiple LLM providers (OpenAI, Azure OpenAI, Anthropic, Google GenAI, AWS Bedrock). Each provider's SDK has different client lifecycle patterns:

- **OpenAI/Azure OpenAI/Anthropic**: Clients can be created synchronously but hold HTTP connections that should be explicitly closed
- **AWS Bedrock (boto3)**: Synchronous client with blocking I/O that freezes the async event loop
- **Google GenAI**: Dual sync/async clients with separate lifecycle management

Note: Azure OpenAI uses the same `AsyncOpenAI` client with a custom `base_url` pointing to the Azure endpoint, avoiding the need for a separate `AsyncAzureOpenAI` class.

### Why boto3 Blocks the Event Loop

Using `yield` with boto3 streaming does not make it async. The `yield` keyword creates a generator for incremental data return, but does not change the underlying I/O behavior:

```python
# boto3 (BLOCKING)
response = boto3_client.converse_stream(...)  # ← Blocks until server responds
for event in response['stream']:  # ← Each iteration blocks waiting for next chunk
    yield event  # ← yield returns control, but NEXT iteration blocks again
```

Each network read is a **blocking socket operation**. The asyncio event loop is frozen during these waits, preventing other coroutines from executing.

```
boto3:    [BLOCK 50ms][yield][BLOCK 80ms][yield][BLOCK 60ms]...
                ↑                 ↑                 ↑
           Event loop        Event loop        Event loop
           frozen            frozen            frozen

aioboto3:  [await 50ms]      [await 80ms]      [await 60ms]...
                ↓                 ↓                 ↓
           Other requests    Other requests    Other requests
           can execute       can execute       can execute
```

### Practical Impact

**Low impact scenarios (blocking is acceptable):**
- Local development with single user
- Production with <5 concurrent Bedrock streaming requests
- Dedicated Bedrock-only deployments without other async workloads

**High impact scenarios (aioboto3 recommended):**
- 10+ simultaneous Bedrock streams
- Mixed async workloads (DB queries, other API calls sharing the event loop)
- Latency-sensitive applications where tail latency matters

| Scenario | boto3 Impact |
|----------|--------------|
| Single stream, ~100 tokens | ~3-5s total blocking (user waiting anyway) |
| 5 concurrent streams | ~20-50% latency increase per stream |
| 10+ concurrent streams | Significant serialization, compounding delays |
| Mixed workload | Other async operations (DB, HTTP) starved during Bedrock I/O |

### Consequences Without Proper Lifecycle Management

- Connection pool exhaustion under load
- Resource leaks in long-running applications
- `APITimeoutError` from exhausted connection pools (especially with streaming)

### Why aioboto3 Requires Async Context Managers

Unlike OpenAI/Anthropic SDKs where you can create a client synchronously and optionally close it later, aioboto3 has stricter requirements that drove our design:

1. **Async client creation**: aioboto3's `session.client()` returns a [`ClientCreatorContext`](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/session.py#L26-L36), not the client itself. The actual client is only available after entering the async context manager (`async with`). This is because credential resolution, endpoint discovery, and HTTP session setup are [async operations](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/session.py#L133-L259).

2. **aiohttp requires explicit cleanup**: aiohttp's [`__del__`](https://github.com/aio-libs/aiohttp/blob/957d5ba18224b10d428f3ed7fe450ffc2c2978ca/aiohttp/client.py#L421-L431) only emits a `ResourceWarning` for unclosed sessions—it does not actually close connections. Failing to call [`__aexit__`](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/httpsession.py#L109-L115) leaves TCP connections allocated. Since aiohttp's connector has a [default limit of 100 connections](https://github.com/aio-libs/aiohttp/blob/957d5ba18224b10d428f3ed7fe450ffc2c2978ca/aiohttp/connector.py#L254), unclosed clients eventually cause new requests to block waiting for available connections, leading to timeouts.

3. **Session vs client lifecycle**: In boto3, you can [hold a client indefinitely](https://github.com/boto/boto3/blob/43f6f80eb6c93d085b98a6d2eba74fe498e460f5/boto3/session.py#L337-L339). In aioboto3, the client's HTTP session is [tied to the context manager scope](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/client.py#L639-L644)—exiting the context [sets `_sessions = None`](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/httpsession.py#L114-L115), making subsequent API calls fail.

These constraints meant we could not simply "wrap" aioboto3 to match the OpenAI/Anthropic pattern. Instead, we adopted aioboto3's context manager pattern for all providers, ensuring consistency and proper resource cleanup everywhere.

## Design Decision: Unified Factory Pattern

All providers use a factory callable that returns an async context manager. The factory captures the necessary configuration in a closure, creating fresh clients per request:

```python
ClientT = TypeVar("ClientT")

class PlaygroundStreamingClient(ABC, Generic[ClientT]):
    _client_factory: Callable[[], AsyncContextManager[ClientT]]
    
    async def chat_completion_create(self, ...):
        async with self._client_factory() as client:  # client is typed as ClientT
            # Provider-specific logic using client
            ...

# Subclasses specify their client type
class OpenAIBaseStreamingClient(PlaygroundStreamingClient["AsyncOpenAI"]): ...
class AnthropicStreamingClient(PlaygroundStreamingClient["AsyncAnthropic"]): ...
class GoogleStreamingClient(PlaygroundStreamingClient["GoogleAsyncClient"]): ...
class BedrockStreamingClient(PlaygroundStreamingClient["BedrockRuntimeClient"]): ...
```

### Factory Implementations by Provider

| Provider | Factory Implementation |
|----------|------------------------|
| OpenAI | `lambda: AsyncOpenAI(api_key=api_key, ...)` |
| Azure OpenAI | `lambda: AsyncOpenAI(api_key=api_key, base_url=azure_base_url, ...)` |
| Anthropic | `lambda: AsyncAnthropic(api_key=api_key, ...)` |
| Google GenAI | `lambda: Client(api_key=api_key).aio` |
| AWS Bedrock | `lambda: session.client("bedrock-runtime", ...)` |

Note: Azure OpenAI reuses `AsyncOpenAI` with a custom `base_url` (e.g., `https://{endpoint}/openai/v1/`). This is cleaner than using the deprecated `AsyncAzureOpenAI` class and works with Azure AD token providers passed as `api_key` (requires openai>=1.106.0).

### Consumption Pattern

All providers use identical consumption:

```python
async def chat_completion_create(self, messages, tools, **params):
    async with self._client_factory() as client:
        # For OpenAI/Azure/Anthropic: Wrap httpx client for instrumentation
        client._client = _HttpxClient(client._client, self._attributes)
        
        # Provider-specific API calls
        response = await client.chat.completions.create(...)  # OpenAI / Azure OpenAI
        response = await client.messages.stream(...)          # Anthropic
        response = await client.models.generate_content_stream(...)  # Google
        response = await client.converse_stream(...)          # Bedrock
```

### Benefits

| Aspect | Fresh Client Pattern |
|--------|---------------------|
| **Consistency** | All providers identical |
| **Resource cleanup** | Automatic via context manager |
| **Credential refresh** | Automatic (AWS IAM, Azure AD, etc.) |
| **Simplicity** | No wrapper classes needed |
| **Instrumentation** | Applied just-in-time, per-request |
| **Type safety** | Generic base class ensures `client` is typed correctly |

### Connection Overhead Tradeoff

Creating a fresh client per request means **no connection pooling across requests**. Both httpx and aiohttp close all pooled connections when the client exits:

- **httpx**: [`AsyncClient.aclose()`](https://github.com/encode/httpx/blob/0.27.0/httpx/_client.py#L1978-L1988) calls [`pool.aclose()`](https://github.com/encode/httpcore/blob/0.18.0/httpcore/_async/connection_pool.py#L347-L353), which clears and closes all connections
- **aiohttp**: [`ClientSession.close()`](https://github.com/aio-libs/aiohttp/blob/957d5ba18224b10d428f3ed7fe450ffc2c2978ca/aiohttp/client.py#L1360-L1368) calls [`connector.close()`](https://github.com/aio-libs/aiohttp/blob/957d5ba18224b10d428f3ed7fe450ffc2c2978ca/aiohttp/connector.py#L442-L455), which closes all transports

**Per-request overhead:**

| Component | Latency |
|-----------|---------|
| TCP handshake | 1 RTT (1-5ms same-region, 50-200ms cross-region) |
| TLS handshake | 1-2 RTTs + crypto (~10-50ms) |
| **Total** | **~20-250ms per request** |

**Relative impact:**

| Scenario | Overhead as % of total latency |
|----------|-------------------------------|
| Typical LLM streaming (1-30s) | ~1-10% |
| Short prompts, fast responses | More noticeable |
| High concurrency | Compounded connection establishment |
| Cross-region API calls | Higher due to RTT |

**Why we accept this tradeoff:**

1. **Correctness**: Guaranteed resource cleanup, no connection leaks
2. **Consistency**: All providers behave identically
3. **Credential refresh**: AWS IAM/Azure AD tokens refresh automatically
4. **Simplicity**: No complex connection pool management or reuse logic

For deployments where connection overhead is critical, consider:
- Deploying Phoenix closer to the LLM provider's region
- Using a connection-pooling proxy (e.g., envoy, nginx) in front of the LLM APIs
- Implementing per-provider client caching with explicit lifecycle management (more complex, not currently supported)

### Alternative Considered: Thread Pool Workaround

If aioboto3 were not feasible, boto3 could be run in a thread pool to release the event loop:

```python
from starlette.concurrency import run_in_threadpool

# Runs boto3 in thread, doesn't block event loop
await run_in_threadpool(boto3_client.converse_stream, ...)
```

**This approach would allow connection pooling if we reused clients:**

| Provider | Thread Pool + Persistent Client | Current Approach (aioboto3) |
|----------|--------------------------------|----------------------------|
| boto3/Bedrock | Pooled connections | Fresh client per request |
| OpenAI | Pooled connections | Fresh client per request |
| Anthropic | Pooled connections | Fresh client per request |
| Google GenAI | Pooled connections | Fresh client per request |

Note: The previous boto3 implementation already created fresh clients per request, so it had the same connection overhead. The thread pool approach would only save connection overhead if we also changed to reusing persistent clients.

**Tradeoffs of persistent clients with thread pool:**

| Aspect | Persistent Clients | Fresh Clients (current) |
|--------|-------------------|------------------------|
| Connection overhead | None (pooled) | ~20-250ms per request |
| AWS credential refresh | Manual refresh needed | Automatic |
| Thread consumption | One per concurrent request | N/A (true async) |
| Resource cleanup | Must manage lifecycle | Automatic via context manager |
| Complexity | Higher (lifecycle, thread safety) | Lower |

### Decision

We chose aioboto3 because:
1. **Consistency**: All providers use the same async context manager pattern
2. **True async I/O**: No thread pool overhead or complexity
3. **Future-proofing**: Better scaling for high-concurrency deployments
4. **Credential refresh**: aioboto3's fresh-client pattern handles AWS credential expiration automatically

For most users, the blocking from boto3 is not critical, but aioboto3 is the correct architectural choice for an async server.

## Technical Appendix: SDK Client Lifecycle Details

This section provides detailed code citations for each SDK's async context manager implementation.

### OpenAI SDK

The OpenAI Python SDK wraps httpx and implements async context manager protocol.

**Context Manager Implementation:**
[openai-python/src/openai/_base_client.py#L1428-L1437](https://github.com/openai/openai-python/blob/d3e632171c7842abf97b26379f564531d80ad096/src/openai/_base_client.py#L1428-L1437)

```python
async def __aenter__(self: _T) -> _T:
    return self

async def __aexit__(
    self,
    exc_type: type[BaseException] | None,
    exc: BaseException | None,
    exc_tb: TracebackType | None,
) -> None:
    await self.close()
```

**Close Method (releases httpx connections):**
[openai-python/src/openai/_base_client.py#L1421-L1426](https://github.com/openai/openai-python/blob/d3e632171c7842abf97b26379f564531d80ad096/src/openai/_base_client.py#L1421-L1426)

```python
async def close(self) -> None:
    """Close the underlying HTTPX client.

    The client will *not* be usable after this.
    """
    await self._client.aclose()
```

### Anthropic SDK

The Anthropic SDK shares the same base client architecture as OpenAI (both use httpx).

**Context Manager Implementation:**
[anthropic-sdk-python/src/anthropic/_base_client.py#L1533-L1542](https://github.com/anthropics/anthropic-sdk-python/blob/2eb941512885bdea844cb46e3f93b60ffa51973b/src/anthropic/_base_client.py#L1533-L1542)

```python
async def __aenter__(self: _T) -> _T:
    return self

async def __aexit__(
    self,
    exc_type: type[BaseException] | None,
    exc: BaseException | None,
    exc_tb: TracebackType | None,
) -> None:
    await self.close()
```

**Close Method:**
[anthropic-sdk-python/src/anthropic/_base_client.py#L1526-L1531](https://github.com/anthropics/anthropic-sdk-python/blob/2eb941512885bdea844cb46e3f93b60ffa51973b/src/anthropic/_base_client.py#L1526-L1531)

```python
async def close(self) -> None:
    """Close the underlying HTTPX client.

    The client will *not* be usable after this.
    """
    await self._client.aclose()
```

### Google GenAI SDK

The Google GenAI SDK provides separate sync and async clients with explicit lifecycle methods.

**Async Context Manager:**
[python-genai/google/genai/client.py#L248-L257](https://github.com/googleapis/python-genai/blob/48f8256202a9ea3abfb7790fa80fcbf68e541131/google/genai/client.py#L248-L257)

```python
async def __aenter__(self) -> 'AsyncClient':
  return self

async def __aexit__(
    self,
    exc_type: Optional[Exception],
    exc_value: Optional[Exception],
    traceback: Optional[TracebackType],
) -> None:
  await self.aclose()
```

**Async Close Method:**
[python-genai/google/genai/client.py#L218-L246](https://github.com/googleapis/python-genai/blob/48f8256202a9ea3abfb7790fa80fcbf68e541131/google/genai/client.py#L218-L246)

```python
async def aclose(self) -> None:
  """Closes the async client explicitly.

  However, it doesn't close the sync client, which can be closed using the
  Client.close() method or using the context manager.
  ...
  """
  await self._api_client.aclose()

  if self._has_nextgen_client:
    await self._nextgen_client.close()
```

### aioboto3/aiobotocore (AWS Bedrock)

aioboto3 requires a fundamentally different pattern because client creation is async and involves credential resolution.

**aioboto3 Session (inherits from boto3, swaps async botocore):**
[aioboto3/aioboto3/session.py#L22-L58](https://github.com/terrycain/aioboto3/blob/37216db0083e28511c4d82931855f8af2b1b102b/aioboto3/session.py#L22-L58)

```python
class Session(boto3.session.Session):
    """
    A session stores configuration state and allows you to create service
    clients and resources.
    """
    def __init__(self, ...):
        if botocore_session is not None:
            self._session = botocore_session
        else:
            # Create a new default session
            self._session = aiobotocore.session.get_session()
```

**ClientCreatorContext (wraps async client creation):**
[aiobotocore/aiobotocore/session.py#L26-L36](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/session.py#L26-L36)

```python
class ClientCreatorContext:
    def __init__(self, coro):
        self._coro = coro
        self._client = None

    async def __aenter__(self) -> AioBaseClient:
        self._client = await self._coro
        return await self._client.__aenter__()

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._client.__aexit__(exc_type, exc_val, exc_tb)
```

**AioBaseClient Context Manager (manages HTTP session):**
[aiobotocore/aiobotocore/client.py#L639-L644](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/client.py#L639-L644)

```python
async def __aenter__(self):
    await self._endpoint.http_session.__aenter__()
    return self

async def __aexit__(self, exc_type, exc_val, exc_tb):
    await self._endpoint.http_session.__aexit__(exc_type, exc_val, exc_tb)
```

**HTTP Session Lifecycle (aiohttp connector cleanup):**
[aiobotocore/aiobotocore/httpsession.py#L104-L115](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/httpsession.py#L104-L115)

```python
async def __aenter__(self):
    assert self._sessions is None
    self._sessions = {}
    return self

async def __aexit__(self, exc_type, exc_val, exc_tb):
    assert self._sessions is not None, 'Session was never entered'
    self._sessions.clear()
    await self._exit_stack.aclose()
    # Make _sessions unusable once context is exited
    self._sessions = None
```

### Why aioboto3 Differs from OpenAI/Anthropic

| Aspect | OpenAI/Anthropic | aioboto3 |
|--------|------------------|----------|
| Client Creation | Synchronous | Asynchronous (credential resolution, etc.) |
| HTTP Library | httpx | aiohttp |
| Connection Management | Internal, lazy | Explicit, via context manager |
| Credential Handling | Static API key | Can expire (IAM roles, STS tokens) |

The aioboto3 design enforces context manager usage because:

1. **Async client creation**: Credential resolution, endpoint discovery, and connection setup are async operations that cannot happen in `__init__`

2. **aiohttp requires explicit cleanup**: Unlike httpx which can clean up on garbage collection, aiohttp connection pools must be explicitly closed

3. **Credential refresh**: AWS credentials can expire; creating a fresh client per-request allows automatic credential refresh

### boto3 vs aiobotocore: Code-Level Comparison

**botocore (synchronous) - blocking socket read:**
[botocore/response.py#L92-L110](https://github.com/boto/botocore/blob/82f7c427d516c22db1c7cf5c6cf3d48ad2e50e26/botocore/response.py#L92-L110)

```python
def read(self, amt=None):
    """Read at most amt bytes from the stream."""
    try:
        chunk = self._raw_stream.read(amt)  # ← Blocking urllib3 socket read
    except URLLib3ReadTimeoutError as e:
        raise ReadTimeoutError(endpoint_url=e.url, error=e)
    # ...
    return chunk
```

The `self._raw_stream.read()` call blocks the entire Python thread (and thus the asyncio event loop) until data arrives from the socket.

**boto3 Session.client() - returns client directly:**
[boto3/session.py#L337-L339](https://github.com/boto/boto3/blob/43f6f80eb6c93d085b98a6d2eba74fe498e460f5/boto3/session.py#L337-L339)

```python
return self._session.create_client(
    service_name, **create_client_kwargs
)
```

boto3's `Session.client()` returns the client immediately (synchronously). The underlying `botocore.session.create_client()` creates a sync client with blocking urllib3 connections.

**aiobotocore Session.create_client() - wraps in async context manager:**
[aiobotocore/session.py#L129-L130](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/session.py#L129-L130)

```python
def create_client(self, *args, **kwargs):
    return ClientCreatorContext(self._create_client(*args, **kwargs))
```

aiobotocore wraps the async client creation in `ClientCreatorContext`, requiring `async with` usage. The actual client creation happens asynchronously in `_create_client()` (lines 133-259), including async credential resolution.

**aiobotocore (asynchronous) - non-blocking await:**
[aiobotocore/response.py#L52-L75](https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/response.py#L52-L75)

```python
async def read(self, amt=None):
    """Read at most amt bytes from the stream."""
    try:
        chunk = await self.__wrapped__.content.read(  # ← Non-blocking aiohttp read
            amt if amt is not None else -1
        )
    except asyncio.TimeoutError as e:
        raise AioReadTimeoutError(endpoint_url=self.__wrapped__.url, error=e)
    # ...
    return chunk
```

The `await` keyword yields control to the event loop. Under the hood, aiohttp uses asyncio futures:

[aiohttp/streams.py#L342-L361](https://github.com/aio-libs/aiohttp/blob/957d5ba18224b10d428f3ed7fe450ffc2c2978ca/aiohttp/streams.py#L342-L361)

```python
async def _wait(self, func_name: str) -> None:
    # ...
    waiter = self._waiter = self._loop.create_future()  # ← Create asyncio future
    try:
        with self._timer:
            await waiter  # ← Yield to event loop until data arrives
    finally:
        self._waiter = None
```

[aiohttp/streams.py#L402-L428](https://github.com/aio-libs/aiohttp/blob/957d5ba18224b10d428f3ed7fe450ffc2c2978ca/aiohttp/streams.py#L402-L428)

```python
async def read(self, n: int = -1) -> bytes:
    # ...
    while not self._buffer and not self._eof:
        await self._wait("read")  # ← Suspends coroutine, other tasks can run
    return self._read_nowait(n)
```

The key difference: `await self._wait("read")` suspends the coroutine and returns control to the event loop. The future is resolved when data arrives via the socket callback, at which point the coroutine resumes. During the wait, other coroutines (handling other requests) can execute.

## References

- [boto3](https://github.com/boto/boto3) @ `43f6f80eb6c93d085b98a6d2eba74fe498e460f5`
- [botocore](https://github.com/boto/botocore) @ `82f7c427d516c22db1c7cf5c6cf3d48ad2e50e26`
- [OpenAI Python SDK](https://github.com/openai/openai-python) @ `d3e632171c7842abf97b26379f564531d80ad096`
- [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python) @ `2eb941512885bdea844cb46e3f93b60ffa51973b`
- [Google GenAI Python SDK](https://github.com/googleapis/python-genai) @ `48f8256202a9ea3abfb7790fa80fcbf68e541131`
- [aioboto3](https://github.com/terrycain/aioboto3) @ `37216db0083e28511c4d82931855f8af2b1b102b`
- [aiobotocore](https://github.com/aio-libs/aiobotocore) @ `93af53a8cd8faead9747561abcff4f6631afa732`
- [aiohttp](https://github.com/aio-libs/aiohttp) @ `957d5ba18224b10d428f3ed7fe450ffc2c2978ca`
