# Phoenix OTEL Reference

Welcome to the Phoenix OTEL reference documentation. This package provides a lightweight wrapper around OpenTelemetry primitives with Phoenix-aware defaults and tracing decorators for common GenAI patterns. `arize-phoenix-otel` simplifies OpenTelemetry configuration for Phoenix users by providing:

- Phoenix-aware defaults for common OpenTelemetry primitives
- Automatic configuration from environment variables 
- Drop-in replacements for OTel classes with enhanced functionality
- Simplified tracing setup with the `register()` function
- Tracing decorators for GenAI patterns

The key components include:

- **[Register](api/register)** - Simple setup and configuration with `register()`
- **[TracerProvider](api/provider)** - Phoenix-aware tracer provider
- **[Span Processors](api/processors)** - Batch and simple span processors
- **[Exporters](api/exporters)** - HTTP and gRPC span exporters

## Installation

```bash
pip install arize-phoenix-otel
```

## Quick Start

The simplest way to get started is with the `register()` function:

```python
from phoenix.otel import register

# Simple setup with automatic instrumentation (recommended)
tracer_provider = register(auto_instrument=True)
```

This is all you need to get started using OpenTelemetry with Phoenix! The `register()` function defaults to sending spans to an endpoint at `http://localhost` using gRPC. With `auto_instrument=True`, your AI/ML libraries are automatically traced

### Basic Configuration

```python
from phoenix.otel import register

# Configure project name, headers, and batch processing
tracer_provider = register(
    project_name="my-llm-app",
    headers={"Authorization": "Bearer TOKEN"},
    batch=True
)
```

### Automatic Instrumentation (Recommended)

For the best experience with minimal setup, enable automatic instrumentation by setting `auto_instrument=True`. This automatically instruments popular AI/ML libraries like OpenAI, Anthropic, LangChain, LlamaIndex, and many others:

```python
from phoenix.otel import register

# Recommended: Enable automatic instrumentation
tracer_provider = register(
    project_name="my-llm-app",
    auto_instrument=True  # Automatically instruments AI/ML libraries
)

# Now your OpenAI, LangChain, etc. calls are automatically traced!
import openai
client = openai.OpenAI()
response = client.chat.completions.create(  # This will be automatically traced
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

**Note**: `auto_instrument=True` only works if the corresponding OpenInference instrumentation libraries are installed. For example, to automatically trace OpenAI calls, you need `openinference-instrumentation-openai` installed:

```bash
pip install openinference-instrumentation-openai
pip install openinference-instrumentation-langchain  # For LangChain
pip install openinference-instrumentation-llama-index  # For LlamaIndex
```

See the [OpenInference repository](https://github.com/Arize-ai/openinference) for the complete list of available instrumentation packages.

**Production Tip**: For production deployments, set `batch=True` to improve performance by batching spans before sending them to the collector. Spans are exported in the background, so your application won't be blocked:

```python
tracer_provider = register(
    auto_instrument=True,
    batch=True  # Recommended for production - exports spans in background
)
```

## Authentication

If the `PHOENIX_API_KEY` environment variable is set, `register()` will automatically add an `authorization` header to each span payload.

```python
# Set environment variable
# export PHOENIX_API_KEY=your-api-key

from phoenix.otel import register
tracer_provider = register()  # Automatically uses API key for auth
```

## Endpoint Configuration

There are two ways to configure the collector endpoint:

### Using Environment Variables

If you're setting the `PHOENIX_COLLECTOR_ENDPOINT` environment variable, `register()` will automatically try to send spans to your Phoenix server using gRPC.

```bash
export PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix.com:6006
```

```python
from phoenix.otel import register
tracer_provider = register()
```

### Specifying the Endpoint Directly

When passing in the `endpoint` argument, **you must specify the fully qualified endpoint**. For example, to export spans via HTTP to localhost, use Phoenix's HTTP collector endpoint: `http://localhost:6006/v1/traces`. The default gRPC endpoint is different: `http://localhost:4317`.

```python
from phoenix.otel import register

# HTTP endpoint
tracer_provider = register(endpoint="http://localhost:6006/v1/traces")

# Custom gRPC endpoint
tracer_provider = register(endpoint="http://localhost:9999", protocol="grpc")
```

The `protocol` argument can be used to enforce the OTLP transport protocol regardless of the endpoint specified. Valid protocols are: "http/protobuf" and "grpc".

## Drop-in Replacement for OTel Primitives

For more granular tracing configuration, Phoenix OTEL wrappers can be used as drop-in replacements for OpenTelemetry primitives:

```python
from opentelemetry import trace as trace_api
from phoenix.otel import HTTPSpanExporter, TracerProvider, SimpleSpanProcessor

tracer_provider = TracerProvider()
span_exporter = HTTPSpanExporter(endpoint="http://localhost:6006/v1/traces")
span_processor = SimpleSpanProcessor(span_exporter=span_exporter)
tracer_provider.add_span_processor(span_processor)
trace_api.set_tracer_provider(tracer_provider)
```

### Simplified Configuration with Endpoint Inference

Wrappers have Phoenix-aware defaults to greatly simplify the OpenTelemetry configuration process. A special `endpoint` keyword argument can be passed to either a `TracerProvider`, `SimpleSpanProcessor` or `BatchSpanProcessor` to automatically infer which `SpanExporter` to use:

```python
from phoenix.otel import TracerProvider

# Automatically configures the appropriate span exporter
tracer_provider = TracerProvider(endpoint="http://localhost:4317")
```

## Span Processors

### Multiple Span Processors

The `phoenix.otel` TracerProvider automatically creates a default span processor that sends spans to the Phoenix collector endpoint. By default, adding a new span processor will replace this auto-created processor.

To keep the default processor alongside new ones, pass `replace_default_processor=False`:

```python
from phoenix.otel import TracerProvider, BatchSpanProcessor

# TracerProvider automatically creates a default processor
tracer_provider = TracerProvider()

# This replaces the default processor (default behavior)
tracer_provider.add_span_processor(BatchSpanProcessor())

# This keeps the default processor and adds another one
tracer_provider.add_span_processor(
    BatchSpanProcessor(), 
    replace_default_processor=False
)
```

### Batch Processing

```python
from phoenix.otel import TracerProvider, BatchSpanProcessor

tracer_provider = TracerProvider()
batch_processor = BatchSpanProcessor()
tracer_provider.add_span_processor(batch_processor)
```

### Custom GRPC Endpoints

```python
from phoenix.otel import TracerProvider, BatchSpanProcessor, GRPCSpanExporter

tracer_provider = TracerProvider()
batch_processor = BatchSpanProcessor(
    span_exporter=GRPCSpanExporter(endpoint="http://custom-endpoint.com:6789")
)
tracer_provider.add_span_processor(batch_processor)
```

## Resource Configuration

```python
from opentelemetry import trace as trace_api
from phoenix.otel import Resource, PROJECT_NAME, TracerProvider

tracer_provider = TracerProvider(
    resource=Resource({PROJECT_NAME: "my-project"})
)
trace_api.set_tracer_provider(tracer_provider)
```

## Advanced Configuration

Both `register()` and `TracerProvider` accept all the same keyword arguments as the standard OpenTelemetry `TracerProvider`, allowing you to configure advanced features like custom ID generators, sampling, and span limits.

```python
from opentelemetry.sdk.extension.aws.trace import AwsXRayIdGenerator
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
from phoenix.otel import register, TracerProvider

# Configure directly with register()
tracer_provider = register(
    project_name="my-app",
    id_generator=AwsXRayIdGenerator(),  # AWS X-Ray compatible IDs
    sampler=TraceIdRatioBased(0.1),     # Sample 10% of traces
)

# Or configure TracerProvider directly
tracer_provider = TracerProvider(
    project_name="my-app",
    id_generator=AwsXRayIdGenerator(),
    sampler=TraceIdRatioBased(0.5)
)
```

## Environment Variables

The package recognizes these Phoenix-specific environment variables for automatic configuration:

- `PHOENIX_COLLECTOR_ENDPOINT`: Collector endpoint URL (e.g., `https://your-phoenix.com:6006`)
- `PHOENIX_PROJECT_NAME`: Project name for spans (e.g., `my-llm-app`)
- `PHOENIX_API_KEY`: User or system key
- `PHOENIX_GRPC_PORT`: gRPC port override (defaults to 4317)
- `PHOENIX_CLIENT_HEADERS`: Additional headers for requests (e.g., `Authorization=Bearer token,custom-header=value`)

### Environment Variable Examples

```bash
# Local Phoenix server (default)
export PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006"

# Phoenix Cloud instance
export PHOENIX_API_KEY="your-api-key"
export PHOENIX_COLLECTOR_ENDPOINT="https://app.phoenix.arize.com/s/your-space"
export PHOENIX_PROJECT_NAME="production-app"

# Custom Phoenix instance with authentication
export PHOENIX_COLLECTOR_ENDPOINT="https://your-phoenix-instance.com"
export PHOENIX_API_KEY="your-api-key"
export PHOENIX_CLIENT_HEADERS="Authorization=Bearer your-api-key,custom-header=value"

# Override default gRPC port
export PHOENIX_GRPC_PORT="9999"
```

When these environment variables are set, `register()` and Phoenix OTEL components will automatically use them for configuration.

## Using Decorators

Phoenix provides helpful decorators to make manual instrumentation easier. After setting up your tracer, you can instrument functions with simple decorators:

```python
from phoenix.otel import register

tracer_provider = register(project_name="my-project")
tracer = tracer_provider.get_tracer(__name__)

@tracer.chain
def process_data(input_text: str) -> str:
    return f"Processed: {input_text}"

result = process_data("hello world")  # This call will be traced
```

### OpenInference Span Kinds

Phoenix decorators support different span kinds that correspond to common AI application patterns:

- **Chains**: For sequential operations and workflows
- **Agents**: For autonomous AI agents
- **Tools**: For function calls and tool usage
- **LLMs**: For language model interactions
- **Retrievers**: For retrieval operations
- **Embeddings**: For embedding generation

### Chains

Use `@tracer.chain` for sequential operations and workflows:

#### Using Decorators

```python
@tracer.chain
def process_document(document: str) -> str:
    # Process the document
    processed = document.upper()
    return processed

# Call the decorated function
result = process_document("hello world")
```

#### Using Context Managers

```python
def process_document_manual(document: str) -> str:
    with tracer.start_as_current_span(
        "process_document",
        openinference_span_kind="chain"
    ) as span:
        span.set_input(document)
        processed = document.upper()
        span.set_output(processed)
        return processed
```

### Agents

Use `@tracer.agent` for autonomous AI agents:

#### Using Decorators

```python
@tracer.agent
def ai_agent(query: str) -> str:
    # Agent logic here
    response = f"Agent response to: {query}"
    return response
```

#### Using Context Managers

```python
def ai_agent_manual(query: str) -> str:
    with tracer.start_as_current_span(
        "ai_agent",
        openinference_span_kind="agent"
    ) as span:
        span.set_input(query)
        response = f"Agent response to: {query}"
        span.set_output(response)
        return response
```

### Tools

Use `@tracer.tool` for function calls and tool usage:

#### Using Decorators

```python
@tracer.tool
def get_weather(city: str) -> str:
    # Simulate weather API call
    return f"Weather in {city}: Sunny, 75°F"

@tracer.tool
def search_database(query: str) -> list:
    # Simulate database search
    return [f"Result 1 for {query}", f"Result 2 for {query}"]
```

#### Using Context Managers

```python
def get_weather_manual(city: str) -> str:
    with tracer.start_as_current_span(
        "get_weather",
        openinference_span_kind="tool"
    ) as span:
        span.set_input(city)
        weather = f"Weather in {city}: Sunny, 75°F"
        span.set_output(weather)
        return weather
```

### LLMs

Use `@tracer.llm` for language model interactions with custom input/output processing:

#### Using Decorators with Processing Functions

```python
from typing import Dict, List, Optional
from openai import OpenAI
from openai.types.chat import ChatCompletion, ChatCompletionMessageParam
from opentelemetry.util.types import AttributeValue

openai_client = OpenAI()

def process_input(
    messages: List[ChatCompletionMessageParam],
    model: str,
    temperature: Optional[float] = None,
    **kwargs
) -> Dict[str, AttributeValue]:
    """Process input parameters for LLM span attributes."""
    return {
        "llm.input_messages": [{"role": msg["role"], "content": msg["content"]} for msg in messages],
        "llm.model_name": model,
        "llm.temperature": temperature,
    }

def process_output(response: ChatCompletion) -> Dict[str, AttributeValue]:
    """Process LLM response for span attributes."""
    message = response.choices[0].message
    return {
        "llm.output_messages": [{"role": message.role, "content": message.content}],
        "llm.token_count.prompt": response.usage.prompt_tokens if response.usage else 0,
        "llm.token_count.completion": response.usage.completion_tokens if response.usage else 0,
    }

@tracer.llm(
    process_input=process_input,
    process_output=process_output,
)
def invoke_llm(
    messages: List[ChatCompletionMessageParam],
    model: str,
    temperature: Optional[float] = None,
) -> ChatCompletion:
    response = openai_client.chat.completions.create(
        messages=messages,
        model=model,
        temperature=temperature,
    )
    return response

# Use the decorated function
response = invoke_llm(
    messages=[{"role": "user", "content": "Hello, world!"}],
    model="gpt-4",
    temperature=0.7
)
```

#### Using Context Managers for LLMs

```python
from opentelemetry.trace import Status, StatusCode

def invoke_llm_manual(messages, model, temperature=None):
    with tracer.start_as_current_span(
        "llm_call",
        openinference_span_kind="llm"
    ) as span:
        # Set input attributes
        span.set_attributes({
            "llm.input_messages": [{"role": msg["role"], "content": msg["content"]} for msg in messages],
            "llm.model_name": model,
            "llm.temperature": temperature,
        })
        
        try:
            response = openai_client.chat.completions.create(
                messages=messages,
                model=model,
                temperature=temperature,
            )
            
            # Set output attributes
            message = response.choices[0].message
            span.set_attributes({
                "llm.output_messages": [{"role": message.role, "content": message.content}],
                "llm.token_count.prompt": response.usage.prompt_tokens if response.usage else 0,
                "llm.token_count.completion": response.usage.completion_tokens if response.usage else 0,
            })
            span.set_status(Status(StatusCode.OK))
            return response
            
        except Exception as error:
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR))
            raise
```

### Retrievers and Embeddings

Use `@tracer.retriever` and `@tracer.embedding` for retrieval and embedding operations:

```python
@tracer.retriever
def search_documents(query: str, limit: int = 10) -> List[str]:
    # Simulate document retrieval
    return [f"Document {i} matching '{query}'" for i in range(limit)]

@tracer.embedding
def generate_embedding(text: str) -> List[float]:
    # Simulate embedding generation
    return [0.1, 0.2, 0.3, 0.4, 0.5]
```

### Additional Features

#### Suppress Tracing

Use the `suppress_tracing()` context manager to temporarily disable tracing:

```python
from openinference.instrumentation import suppress_tracing

with suppress_tracing():
    # This function call will not be traced
    result = my_function("input")
```

#### Adding Context Attributes

Use `using_attributes()` to add context attributes to spans:

```python
from openinference.instrumentation import using_attributes

with using_attributes(session_id="123", user_id="user456"):
    # All spans created within this context will have these attributes
    result = my_function("input")
```

For more detailed examples and advanced usage patterns, see the [Phoenix tracing documentation](https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument-python).

## API Reference

```{toctree}
:maxdepth: 2

api/register
api/provider
api/processors
api/exporters
api/settings
```

## External Links

- [Main Phoenix Documentation](https://arize.com/docs/phoenix)
- [Python Reference](https://arize-phoenix.readthedocs.io/)
- [GitHub Repository](https://github.com/Arize-ai/phoenix)
- [PyPI Package](https://pypi.org/project/arize-phoenix-otel/) 