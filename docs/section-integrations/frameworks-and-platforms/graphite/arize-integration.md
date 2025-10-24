# Arize & Phoenix Integration Guide

This document provides comprehensive guidance on integrating Graphite with Arize and Phoenix for distributed tracing and observability.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Tracing Options](#tracing-options)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Graphite integrates with OpenTelemetry to provide distributed tracing through multiple backends:

- **Arize**: Production-grade monitoring and observability platform for AI applications
- **Phoenix**: Local/remote tracing solution ideal for development and debugging
- **Auto**: Automatic detection of available tracing endpoints
- **In-Memory**: Testing mode without external dependencies

The integration is built on top of OpenTelemetry and automatically instruments:
- OpenAI API calls
- LLM interactions
- Tool executions
- Workflow orchestration
- Node operations

## Installation

### Core Dependencies

Grafi includes the following observability dependencies by default:

```toml
dependencies = [
    "openinference-instrumentation-openai>=0.1.30",
    "arize-otel>=0.10.0",
    "arize-phoenix-otel>=0.13.1",
]
```

These are automatically installed when you install Grafi:

```bash
# Using pip
pip install grafi

# Using poetry
poetry add grafi

# Using uv
uv pip install grafi
```

### Optional Development Dependencies

For local Phoenix tracing during development:

```bash
pip install arize-phoenix
```

## Configuration

### Docker Compose

To run Phoenix you can run it on your local machine via docker compose

```yaml

version: '3.8'

services:

  phoenix:
    image: arizephoenix/phoenix:latest
    ports:
      - "6006:6006"
      - "4317:4317"
```



### Environment Variables

#### Arize Configuration

Set these environment variables when using Arize:

```bash
# Required for Arize
export ARIZE_API_KEY="your-arize-api-key"
export ARIZE_SPACE_ID="your-space-id"
export ARIZE_PROJECT_NAME="your-project-name"
```

#### Phoenix Configuration

Set these environment variables to override default Phoenix settings:

```bash
# Optional - defaults to localhost:4317
export PHOENIX_ENDPOINT="localhost" # if using docker compose and ports are forwarded
export PHOENIX_PORT="4317" # This will override port settings in setup_tracing()
```

### Setup Function Parameters

The `setup_tracing()` function accepts the following parameters:

```python
def setup_tracing(
    tracing_options: TracingOptions = TracingOptions.AUTO,
    collector_endpoint: str = "localhost",
    collector_port: int = 4317,
    project_name: str = "grafi-trace",
) -> Tracer:
```

- **tracing_options**: Backend to use (ARIZE, PHOENIX, AUTO, IN_MEMORY)
- **collector_endpoint**: Hostname of the collector (default: "localhost")
- **collector_port**: Port number of the collector (default: 4317)
- **project_name**: Name for the tracing project (default: "grafi-trace")


## Tracing Options

Grafi provides four tracing backend options through the `TracingOptions` enum:

### 1. ARIZE - Production Monitoring

Use Arize for production environments with enterprise-grade observability:

```python
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

tracing = setup_tracing(
    tracing_options=TracingOptions.ARIZE,
    collector_endpoint="https://otlp.arize.com/v1",
    project_name="my-dev-project",
)
```

**When to use:**
- Production deployments
- Need for team collaboration and sharing
- Require advanced analytics and monitoring
- Enterprise compliance requirements

### 2. PHOENIX - Local/Remote Development

Use Phoenix for development and debugging:

```python
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

tracer = setup_tracing(
    tracing_options=TracingOptions.PHOENIX,
    collector_endpoint="localhost",
    collector_port=4317,
    project_name="my-dev-project"
)
```

**When to use:**
- Local development and debugging
- Quick iteration and testing
- Learning and experimentation
- Running Phoenix locally or on a remote server

### 3. AUTO - Automatic Detection

Let Grafi automatically detect available tracing endpoints:

```python
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

tracer = setup_tracing(
    tracing_options=TracingOptions.AUTO,
    collector_endpoint="localhost",
    collector_port=4317
)
```

**Detection priority:**
1. Default collector endpoint (if available)
2. Phoenix endpoint from environment variables
3. Falls back to in-memory tracing

**When to use:**
- Development environments with optional Phoenix
- CI/CD pipelines
- Flexible deployment scenarios

### 4. IN_MEMORY - Testing

Use in-memory tracing for tests and offline work:

```python
tracer = setup_tracing(tracing_options=TracingOptions.IN_MEMORY)
```

**When to use:**
- Unit and integration tests
- CI/CD without external dependencies
- Offline development
- Minimal overhead scenarios


## Usage Examples

### Example 1: Basic Setup with AUTO Detection

```python
from grafi.common.containers.container import container
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

# Register the tracer with auto-detection
tracer = setup_tracing(tracing_options=TracingOptions.AUTO)
container.register_tracer(tracer)

# Your assistant code here
```

### Example 2: Production Setup with Arize

```python
from grafi.common.containers.container import container
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

# Ensure environment variables are set
# ARIZE_API_KEY, ARIZE_SPACE_ID, ARIZE_PROJECT_NAME

tracer = setup_tracing(
    tracing_options=TracingOptions.ARIZE,
    collector_endpoint="https://otlp.arize.com/v1",
    project_name="production-assistant"
)
container.register_tracer(tracer)

# Your assistant code here
```

### Example 3: Development with Local Phoenix

First, start Phoenix locally:

```bash
# Install Phoenix if not already installed
pip install arize-phoenix

# Start Phoenix server
docker compose up
```

Then in your code:

```python
from grafi.common.containers.container import container
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

tracer = setup_tracing(
    tracing_options=TracingOptions.PHOENIX,
    collector_endpoint="localhost",
    collector_port=4317,
    project_name="my-dev-assistant"
)
container.register_tracer(tracer)

# Your assistant code here
```

Visit `http://localhost:6006` to view the Phoenix UI.

### Example 4: Testing with In-Memory Tracing

```python
from grafi.common.containers.container import container
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

# Use in-memory tracing for tests
tracer = setup_tracing(tracing_options=TracingOptions.IN_MEMORY)
container.register_tracer(tracer)

# Your test code here
```

### Example 5: Remote Phoenix Instance

```python
from grafi.common.containers.container import container
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

tracer = setup_tracing(
    # If you've set up the ENV Variables then some arguments can be skipped
    tracing_options=TracingOptions.PHOENIX,
    project_name="shared-dev-project"
)
container.register_tracer(tracer)
```

### Example 6: Complete Assistant with Tracing

```python
import os
import uuid
import asyncio
from grafi.common.containers.container import container
from grafi.common.events.topic_events.publish_to_topic_event import PublishToTopicEvent
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing
from grafi.common.models.async_result import async_func_wrapper
from grafi.common.models.invoke_context import InvokeContext
from grafi.common.models.message import Message
from grafi.assistants.assistant_base import AssistantBase

# Setup tracing
tracer = setup_tracing(tracing_options=TracingOptions.AUTO)
container.register_tracer(tracer)

# Get event store
event_store = container.event_store

# Create your assistant
async def main():
    assistant = (
        # YourAssistant is an instance of type grafi.assistants.assistant
        # https://github.com/binome-dev/graphite/blob/main/grafi/assistants/assistant.py
        YourAssistant.builder()
        .name("MyAssistant")
        .api_key(os.getenv("OPENAI_API_KEY"))
        .build()
    )

    # Create invoke context
    invoke_context = InvokeContext(
        conversation_id="conversation_id",
        invoke_id=uuid.uuid4().hex,
        assistant_request_id=uuid.uuid4().hex,
    )

    # Invoke assistant
    input_data = PublishToTopicEvent(
        invoke_context=invoke_context,
        data=[Message(content="Hello!", role="user")]
    )

    output = await async_func_wrapper(
        assistant.invoke(input_data, is_sequential=True)
    )
    print(output)

asyncio.run(main())
```

## Best Practices

### 1. Environment-Specific Configuration

Use different tracing backends for different environments:

```python
import os
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

env = os.getenv("ENVIRONMENT", "development")

if env == "production":
    tracing_option = TracingOptions.ARIZE
    endpoint = "https://otlp.arize.com/v1"
elif env == "staging":
    tracing_option = TracingOptions.PHOENIX
    endpoint = "staging-phoenix.example.com"
elif env == "development":
    tracing_option = TracingOptions.AUTO
    endpoint = "localhost"
else:  # testing
    tracing_option = TracingOptions.IN_MEMORY
    endpoint = "localhost"

tracer = setup_tracing(
    tracing_options=tracing_option,
    collector_endpoint=endpoint,
    project_name=f"{env}-assistant"
)
```

### 2. Early Initialization

Set up tracing early in your application lifecycle, before creating assistants:

```python
# Good: Setup tracing first
tracer = setup_tracing(tracing_options=TracingOptions.AUTO)
container.register_tracer(tracer)

# Then create assistants
assistant = MyAssistant.builder().build()
```

### 3. Project Naming Conventions

Use descriptive project names to organize traces:

```python
tracer = setup_tracing(
    tracing_options=TracingOptions.PHOENIX,
    project_name=f"{app_name}-{environment}-{version}"
)
```

### 4. Secure Credential Management

Never hardcode API keys. Use environment variables or secret management:

```python
import os

# Good: Use environment variables
api_key = os.getenv("ARIZE_API_KEY")

# Bad: Never hardcode
# os.environ["ARIZE_API_KEY"] = "hardcoded-key"
```

### 5. Graceful Degradation with AUTO Mode

Use AUTO mode to gracefully degrade when tracing endpoints are unavailable:

```python
# Will automatically fall back to in-memory if no endpoint available
tracer = setup_tracing(tracing_options=TracingOptions.AUTO)
```

### 6. Testing Isolation

Use IN_MEMORY mode in tests to avoid external dependencies:

```python
import pytest
from grafi.common.instrumentations.tracing import TracingOptions, setup_tracing

@pytest.fixture(autouse=True)
def setup_test_tracing():
    tracer = setup_tracing(tracing_options=TracingOptions.IN_MEMORY)
    container.register_tracer(tracer)
    yield
    # Cleanup if needed
```

## Troubleshooting

### Issue: "Phoenix endpoint is not available"

**Symptom**: ValueError when using PHOENIX tracing option

**Solution**:
1. Ensure Phoenix is running:
   ```bash
   ➜ docker compose up
    nc -zv localhost 4317

    Connection to localhost (::1) 4317 port [tcp/*] succeeded!

    nc -zv localhost 6006

    Connection to localhost (::1) 6006 port [tcp/x11-6] succeeded!
   ```

2. Check the endpoint and port are correct:

   ```python
   tracer = setup_tracing(
       tracing_options=TracingOptions.PHOENIX,
       collector_endpoint="localhost",
       collector_port=4317
   )
   ```

3. Use AUTO mode for graceful fallback:

   ```python
   tracer = setup_tracing(tracing_options=TracingOptions.AUTO)
   ```

### Issue: Arize traces not appearing

**Symptom**: No traces visible in Arize dashboard

**Solution**:
1. Verify environment variables are set:
   ```python
   import os
   print(os.getenv("ARIZE_API_KEY"))
   print(os.getenv("ARIZE_SPACE_ID"))
   print(os.getenv("ARIZE_PROJECT_NAME"))
   ```

2. Check the collector endpoint:
   ```python
   tracer = setup_tracing(
       tracing_options=TracingOptions.ARIZE,
       collector_endpoint="https://otlp.arize.com/v1"
   )
   ```

3. Verify API key has proper permissions

### Issue: Connection timeout with Phoenix

**Symptom**: Slow startup or timeout errors

**Solution**:
1. The endpoint check has a 0.1s timeout, which is normal
2. Use AUTO mode to automatically fall back:
   ```python
   tracer = setup_tracing(tracing_options=TracingOptions.AUTO)
   ```

3. For PHOENIX mode, ensure the endpoint is reachable:
   ```bash
   nc -zv localhost 4317
   ```

### Issue: OpenAI instrumentation not working

**Symptom**: OpenAI calls not showing in traces

**Solution**:
1. Ensure OpenAI is instrumented (done automatically by setup_tracing)
2. Verify tracer is registered before creating assistants:
   ```python
   container.register_tracer(tracer)  # Must be before assistant creation
   ```

### Issue: Traces showing in wrong project

**Symptom**: Traces appear in unexpected project

**Solution**:
Specify project name explicitly:
```python
tracer = setup_tracing(
    tracing_options=TracingOptions.PHOENIX,
    project_name="my-specific-project"
)
```

### Debug Logging

Enable debug logging to troubleshoot tracing issues:

```python
from loguru import logger
import sys

logger.remove()
logger.add(sys.stderr, level="DEBUG")

# Now setup tracing
tracer = setup_tracing(tracing_options=TracingOptions.AUTO)
```

## Additional Resources

### Arize Resources
- [Arize Platform Documentation](https://docs.arize.com/)
- [Arize OpenTelemetry Integration](https://arize.com/docs/ax/integrations/opentelemetry/opentelemetry-arize-otel)
- [Arize Python SDK](https://arize-client-python.readthedocs.io/en/latest/)

### Phoenix Resources
- [Phoenix Documentation](https://docs.arize.com/phoenix)
- [Phoenix GitHub Repository](https://github.com/Arize-ai/phoenix)
- [OpenInference Specification](https://github.com/Arize-ai/openinference)

### Grafi Resources
- [Graphite Documentation](https://binome-dev.github.io/graphite)
- [Event-Driven Workflows](https://binome-dev.github.io/graphite/user-guide/event-driven-workflow/)
- [Graphite GitHub Repository](https://github.com/binome-dev/graphite)

## Support

For issues related to:

- **Graphite tracing integration**: Open an issue on the Grafi repository
- **Arize platform**: Contact Arize support or consult their documentation
- **Phoenix**: Check the Phoenix GitHub issues or documentation

