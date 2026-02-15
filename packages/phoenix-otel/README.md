<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-client">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
                <img alt="Arize Phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg" width="100" />
            </picture>
        </a>
        <br>
        arize-phoenix-otel
    </div>
</h1>

<p align="center">
    <a href="https://pypi.org/project/arize-phoenix-otel/">
        <img src="https://img.shields.io/pypi/v/arize-phoenix-otel" alt="PyPI Version">
    </a>
    <a href="https://arize-phoenix.readthedocs.io/projects/otel/en/latest/index.html">
        <img src="https://img.shields.io/badge/docs-blue?logo=readthedocs&logoColor=white" alt="Documentation">
    </a>
    <img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=8e8e8b34-7900-43fa-a38f-1f070bd48c64&page=packages/phoenix-otel/README.md" />
</p>

Provides a lightweight wrapper around OpenTelemetry primitives with Phoenix-aware defaults. Phoenix OTEL also gives you access to tracing decorators for common GenAI patterns.

## Features

`arize-phoenix-otel` simplifies OpenTelemetry configuration for Phoenix users by providing:

- **Phoenix-aware defaults** for common OpenTelemetry primitives
- **Automatic configuration** from environment variables
- **Drop-in replacements** for OTel classes with enhanced functionality
- **Simplified tracing setup** with the `register()` function
- **Tracing decorators** for GenAI patterns

## Key Benefits

- **Zero Code Changes**: Enable `auto_instrument=True` to automatically instrument AI libraries
- **Production Ready**: Built-in batching and authentication
- **Phoenix Integration**: Seamless integration with Phoenix Cloud and self-hosted instances
- **OpenTelemetry Compatible**: Works with existing OpenTelemetry infrastructure

These defaults are aware of environment variables you may have set to configure Phoenix:

- `PHOENIX_COLLECTOR_ENDPOINT`
- `PHOENIX_PROJECT_NAME`
- `PHOENIX_CLIENT_HEADERS`
- `PHOENIX_API_KEY`
- `PHOENIX_GRPC_PORT`

## Installation

Install via `pip`:

```shell
pip install arize-phoenix-otel
```

## Quick Start

**Recommended**: Enable automatic instrumentation to trace your AI libraries with zero code changes:

```python
from phoenix.otel import register

# Recommended: Automatic instrumentation + production settings
tracer_provider = register(
    auto_instrument=True,  # Auto-trace OpenAI, LangChain, LlamaIndex, etc.
    batch=True,           # Production-ready batching
    project_name="my-app" # Organize your traces
)
```

That's it! All `openinference-*` AI libraries are now automatically traced and sent to Phoenix.

**Note**: `auto_instrument=True` only works if the corresponding OpenInference instrumentation libraries are installed. For example, to automatically trace OpenAI calls, you need `openinference-instrumentation-openai` installed:

```bash
pip install openinference-instrumentation-openai
pip install openinference-instrumentation-langchain  # For LangChain
pip install openinference-instrumentation-llama-index  # For LlamaIndex
```

See the [OpenInference repository](https://github.com/Arize-ai/openinference) for the complete list of available instrumentation packages.

### Authentication

```bash
export PHOENIX_API_KEY="your-api-key"
```

```python
# Or pass directly to register()
tracer_provider = register(api_key="your-api-key")
```

### Endpoint Configuration

Configure where to send your traces:

**Environment Variables** (Recommended):

```bash
export PHOENIX_COLLECTOR_ENDPOINT="https://app.phoenix.arize.com/s/your-space"
export PHOENIX_PROJECT_NAME="my-project"
```

**Direct Configuration**:

```python
tracer_provider = register(
    endpoint="http://localhost:6006/v1/traces",  # HTTP endpoint
    protocol="grpc"  # Or force gRPC protocol
)
```

## Usage Examples

### Simple Setup

```python
from phoenix.otel import register

# Basic setup - sends to localhost
tracer_provider = register(auto_instrument=True)
```

### Production Configuration

```python
tracer_provider = register(
    project_name="my-production-app",
    auto_instrument=True,      # Auto-trace AI/ML libraries
    batch=True,               # Background batching for performance
    api_key="your-api-key",   # Authentication
    endpoint="https://app.phoenix.arize.com/s/your-space"
)
```

### Manual Configuration

For advanced use cases, use Phoenix OTEL components directly:

```python
from phoenix.otel import TracerProvider, BatchSpanProcessor, HTTPSpanExporter

tracer_provider = TracerProvider()
exporter = HTTPSpanExporter(endpoint="http://localhost:6006/v1/traces")
processor = BatchSpanProcessor(span_exporter=exporter)
tracer_provider.add_span_processor(processor)
```

### Using Decorators

```python
from phoenix.otel import register

tracer_provider = register()

# Get a tracer for manual instrumentation
tracer = tracer_provider.get_tracer(__name__)

@tracer.chain
def process_data(data):
    return data + " processed"

@tracer.tool
def weather(location):
    return "sunny"
```

## Environment Variables

| Variable                     | Description          | Example                                      |
| ---------------------------- | -------------------- | -------------------------------------------- |
| `PHOENIX_COLLECTOR_ENDPOINT` | Where to send traces | `https://app.phoenix.arize.com/s/your-space` |
| `PHOENIX_PROJECT_NAME`       | Project name         | `my-llm-app`                                 |
| `PHOENIX_API_KEY`            | Authentication key   | `your-api-key`                               |
| `PHOENIX_CLIENT_HEADERS`     | Custom headers       | `Authorization=Bearer token`                 |
| `PHOENIX_GRPC_PORT`          | gRPC port override   | `4317`                                       |

## Documentation

- **[Full Documentation](https://arize-phoenix.readthedocs.io/projects/otel/en/latest/index.html)** - Complete API reference and guides
- **[Phoenix Docs](https://arize.com/docs/phoenix)** - Detailed tracing examples and patterns
- **[OpenInference](https://github.com/Arize-ai/openinference)** - Auto-instrumentation libraries for frameworks

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://arize-ai.slack.com/join/shared_invite/zt-11t1vbu4x-xkBIHmOREQnYnYDH1GDfCg).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
