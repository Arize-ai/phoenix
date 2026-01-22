# Mock LLM Server

A TypeScript mock server that simulates **OpenAI**, **Anthropic**, and **Google GenAI (Gemini)** APIs for testing streaming, rate limiting, and tool calls. Includes a **real-time dashboard** for monitoring and controlling the server.

## Features

- **OpenAI Chat Completions API** - Full compatibility with the official OpenAI SDK
- **OpenAI Responses API** - Newer API with event-based streaming
- **Anthropic Messages API** - Full compatibility with the official Anthropic SDK
- **Google GenAI (Gemini) API** - Full compatibility with the official @google/genai SDK
- **Streaming support** - SSE streaming with configurable chunk size and delay
- **Tool calls** - Generates fake tool call/use responses based on provided JSON Schema
- **Rate limiting** - Configurable rate limiting with multiple modes
- **Real-time Dashboard** - Monitor connections, adjust latency, toggle rate limiting on-the-fly
- **Error Injection** - Simulate server errors, auth errors, timeouts, and bad requests

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the dashboard (first time only)
pnpm run build:dashboard

# Start the server (development mode with hot reload)
pnpm dev

# Or start without hot reload
pnpm start
```

The server runs on `http://localhost:57593` by default.

## Dashboard

Access the real-time monitoring dashboard at `http://localhost:57593/dashboard`

**Features:**
- **Connection Monitor** - Active connections per endpoint
- **Request Rate Chart** - Live requests/sec graph
- **Latency Controls** - Adjust streaming delays, jitter, chunk size
- **Rate Limiting** - Toggle on/off, select strategy (fixed-window, token-bucket, etc.)
- **Error Injection** - Set error rate and types (500, 401, 403, 400, timeout)
- **Event Log** - Real-time stream of all events

**API Endpoints:**
- `GET /api/config` - Current configuration
- `PATCH /api/config/global` - Update global config
- `PATCH /api/config/endpoints/:endpoint` - Per-endpoint config
- `GET /api/metrics` - Current metrics snapshot
- `POST /api/rate-limit/reset` - Reset rate limit counters
- `WebSocket /ws` - Real-time metrics and events

## Usage with OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:57593/v1",
    api_key="fake-key"  # Any string works
)

# Non-streaming
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### Tool Calls

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What's the weather?"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                },
                "required": ["location"]
            }
        }
    }]
)

# The mock server will generate fake arguments matching the schema
tool_call = response.choices[0].message.tool_calls[0]
print(tool_call.function.name)       # "get_weather"
print(tool_call.function.arguments)  # '{"location": "San Francisco", "unit": "celsius"}'
```

## Usage with Anthropic SDK

Note: The Anthropic SDK automatically adds `/v1` to the base URL, so use the root URL.

```python
from anthropic import Anthropic

client = Anthropic(
    base_url="http://localhost:57593",  # SDK adds /v1 automatically
    api_key="fake-key"  # Any string works
)

# Non-streaming
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.content[0].text)

# Streaming
with client.messages.stream(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="")
```

### Anthropic Tool Use

```python
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "What's the weather?"}],
    tools=[{
        "name": "get_weather",
        "description": "Get the weather for a location",
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City name"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
            },
            "required": ["location"]
        }
    }]
)

# The mock server will generate fake input matching the schema
for block in response.content:
    if block.type == "tool_use":
        print(block.name)   # "get_weather"
        print(block.input)  # {"location": "San Francisco", "unit": "celsius"}
```

## Usage with Google GenAI SDK

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  vertexai: false,
  apiKey: "fake-key",  // Any string works
  httpOptions: {
    baseUrl: "http://localhost:57593",
  },
});

// Non-streaming
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "Hello!",
});
console.log(response.text);

// Streaming
const stream = await ai.models.generateContentStream({
  model: "gemini-2.0-flash",
  contents: "Hello!",
});
for await (const chunk of stream) {
  console.log(chunk.text);
}
```

### Gemini Function Calling

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "What's the weather?",
  config: {
    tools: [{
      functionDeclarations: [{
        name: "get_weather",
        description: "Get the weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" },
            unit: { type: "string", enum: ["celsius", "fahrenheit"] },
          },
          required: ["location"],
        },
      }],
    }],
  },
});

// The mock server will generate fake args matching the schema
if (response.functionCalls) {
  console.log(response.functionCalls[0].name);  // "get_weather"
  console.log(response.functionCalls[0].args);  // { location: "San Francisco", unit: "celsius" }
}
```

## Configuration

Configure via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `57593` |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `false` |
| `RATE_LIMIT_MODE` | `always`, `random`, or `after_n` | `after_n` |
| `RATE_LIMIT_AFTER_N` | Fail after N requests (when mode=after_n) | `5` |
| `RATE_LIMIT_RANDOM_PROBABILITY` | Probability of 429 (when mode=random) | `0.3` |
| `RATE_LIMIT_REQUESTS` | Max requests per window | `10` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `60000` |
| `STREAM_INITIAL_DELAY_MS` | Initial delay before first chunk (time to first token) | `300` |
| `STREAM_DELAY_MS` | Base delay between stream chunks | `50` |
| `STREAM_JITTER_MS` | Random jitter added to delay (0 to N ms) | `30` |
| `STREAM_CHUNK_SIZE` | Characters per stream chunk | `10` |
| `TOOL_CALL_PROBABILITY` | Probability of tool call when tools provided | `0.75` |
| `DEFAULT_RESPONSE` | Static response text (if unset, 50% from response pool, 50% lorem ipsum) | (dynamic) |

### Example: Test Rate Limiting

```bash
# Start with rate limiting enabled, fail after 3 requests
RATE_LIMIT_ENABLED=true RATE_LIMIT_MODE=after_n RATE_LIMIT_AFTER_N=3 pnpm start
```

### Example: Fast Streaming

```bash
# Very fast streaming with small chunks
STREAM_DELAY_MS=10 STREAM_CHUNK_SIZE=5 pnpm start
```

### Example: Always Make Tool Calls

```bash
TOOL_CALL_PROBABILITY=1.0 pnpm start
```

## API Endpoints

### OpenAI-Compatible

| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | Chat Completions API (streaming and non-streaming) |
| `POST /v1/responses` | Responses API (streaming and non-streaming) |
| `GET /v1/models` | List available models |

### Anthropic-Compatible

| Endpoint | Description |
|----------|-------------|
| `POST /v1/messages` | Messages API (streaming and non-streaming) |

### Google GenAI (Gemini)-Compatible

| Endpoint | Description |
|----------|-------------|
| `POST /v1beta/models/:model:generateContent` | Generate content (non-streaming) |
| `POST /v1beta/models/:model:streamGenerateContent` | Generate content (streaming) |
| `POST /v1/models/:model:generateContent` | Generate content v1 (non-streaming) |
| `POST /v1/models/:model:streamGenerateContent` | Generate content v1 (streaming) |

### Admin & Monitoring

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/config` | View current configuration |
| `PATCH /api/config/global` | Update global configuration |
| `GET /api/config/endpoints` | List all endpoints with config |
| `PATCH /api/config/endpoints/:endpoint` | Update endpoint-specific config |
| `DELETE /api/config/endpoints/:endpoint` | Clear endpoint overrides |
| `POST /api/config/reset` | Reset to initial configuration |
| `GET /api/metrics` | Current metrics snapshot |
| `GET /api/metrics/latency/:endpoint` | Latency percentiles for endpoint |
| `POST /api/metrics/reset` | Reset all metrics |
| `POST /api/rate-limit/reset` | Reset all rate limiter states |
| `POST /api/rate-limit/reset/:endpoint` | Reset rate limiter for endpoint |
| `GET /api/rate-limit/strategies` | List available strategies |
| `GET /api/detailed-metrics` | Full detailed metrics snapshot |
| `GET /api/detailed-metrics/export/json` | Export metrics as JSON |
| `GET /api/detailed-metrics/export/csv` | Export time series as CSV |
| `GET /api/failure-modes` | List available failure modes |
| `WebSocket /ws` | Real-time metrics and events |

## Rate Limiting Strategies

The server supports multiple rate limiting strategies per endpoint:

| Strategy | Description |
|----------|-------------|
| `none` | Rate limiting disabled |
| `fixed-window` | Classic fixed time window counter |
| `sliding-window` | Rolling window for smoother limiting |
| `token-bucket` | Allows bursts up to bucket capacity |
| `leaky-bucket` | Processes requests at a fixed rate |
| `after-n` | First N requests succeed, then all return 429 (good for testing retry logic) |
| `random` | Each request has a configurable probability of 429 |
| `always` | Every request returns 429 |

## Responses API Usage

The Responses API uses a different format from Chat Completions:

```python
import httpx

response = httpx.post(
    "http://localhost:57593/v1/responses",
    headers={"Authorization": "Bearer fake-key"},
    json={
        "model": "gpt-4o",
        "input": "What is 2+2?",
        # Or use structured input:
        # "input": [{"type": "message", "role": "user", "content": "Hello"}]
    }
)
print(response.json())
```

### Streaming (Responses API)

The Responses API uses event-based streaming with named events:

```python
import httpx

with httpx.stream(
    "POST",
    "http://localhost:57593/v1/responses",
    headers={"Authorization": "Bearer fake-key"},
    json={"model": "gpt-4o", "input": "Hello", "stream": True}
) as response:
    for line in response.iter_lines():
        print(line)
        # Events: response.created, response.output_text.delta, response.completed, etc.
```

## Anthropic Streaming Details

The Anthropic Messages API uses a different streaming format with named events:

```python
from anthropic import Anthropic

client = Anthropic(
    base_url="http://localhost:57593",  # SDK adds /v1 automatically
    api_key="fake-key"
)

with client.messages.stream(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
) as stream:
    for event in stream:
        if event.type == "content_block_delta":
            if event.delta.type == "text_delta":
                print(event.delta.text, end="")
        elif event.type == "message_delta":
            print(f"\nStop reason: {event.delta.stop_reason}")
```

Event sequence:
1. `message_start` - Initial message object with empty content
2. `content_block_start` - Start of each content block (text or tool_use)
3. `content_block_delta` - Incremental content (text_delta or input_json_delta)
4. `content_block_stop` - End of content block
5. `message_delta` - Final stop_reason and usage
6. `message_stop` - Stream complete

## Project Structure

```
mock-llm-server/
├── src/
│   ├── server.ts              # Express server entry point
│   ├── config.ts              # Environment configuration
│   ├── registry.ts            # Central config & rate limiter registry
│   ├── types.ts               # TypeScript types (OpenAI + Anthropic + Gemini APIs)
│   ├── fake-data.ts           # JSON Schema → fake data generator
│   ├── metrics.ts             # Basic metrics collection
│   ├── detailed-metrics.ts    # Time series & histogram metrics
│   ├── admin/
│   │   ├── index.ts           # Admin module exports
│   │   ├── routes.ts          # REST API routes
│   │   └── websocket.ts       # WebSocket server for real-time updates
│   ├── handlers/
│   │   ├── chat-completions.ts   # OpenAI Chat Completions handler
│   │   ├── responses.ts          # OpenAI Responses API handler
│   │   ├── anthropic-messages.ts # Anthropic Messages API handler
│   │   └── gemini.ts             # Google GenAI (Gemini) handler
│   ├── middleware/
│   │   ├── index.ts           # Middleware exports
│   │   └── request-pipeline.ts # Request processing pipeline
│   ├── providers/
│   │   ├── index.ts           # Provider registry
│   │   ├── types.ts           # Provider type definitions
│   │   ├── openai-chat.ts     # OpenAI Chat provider config
│   │   ├── openai-responses.ts # OpenAI Responses provider config
│   │   ├── anthropic.ts       # Anthropic provider config
│   │   └── gemini.ts          # Gemini provider config
│   └── rate-limiting/
│       ├── index.ts           # Rate limiting exports
│       ├── types.ts           # Rate limiter interfaces
│       ├── factory.ts         # Strategy factory
│       └── strategies/
│           ├── simple.ts      # after-n, random, always strategies
│           ├── fixed-window.ts
│           ├── sliding-window.ts
│           ├── token-bucket.ts
│           └── leaky-bucket.ts
├── dashboard/                 # React monitoring dashboard
│   ├── src/
│   │   ├── App.tsx            # Main dashboard component
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts # WebSocket connection hook
│   │   └── components/
│   │       ├── ConnectionMonitor.tsx
│   │       ├── ConnectionsChart.tsx
│   │       ├── ErrorInjection.tsx
│   │       ├── EventLog.tsx
│   │       ├── FailureModes.tsx
│   │       ├── LatencyControls.tsx
│   │       ├── LatencyHistogram.tsx
│   │       ├── PeakIndicators.tsx
│   │       ├── RateLimitPanel.tsx
│   │       ├── RequestRateChart.tsx
│   │       └── ThroughputChart.tsx
│   └── package.json
├── tests/
│   ├── setup.ts
│   ├── chat-completions.test.ts
│   ├── anthropic-messages.test.ts
│   ├── gemini.test.ts
│   ├── responses.test.ts
│   ├── tool-calls.test.ts
│   ├── rate-limiting.test.ts
│   └── models.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```
