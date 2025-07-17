# Phoenix OTEL Reference

Welcome to the Phoenix OTEL reference documentation. This package provides a lightweight wrapper around OpenTelemetry primitives with Phoenix-aware defaults.

## Overview

`arize-phoenix-otel` simplifies OpenTelemetry configuration for Phoenix users by providing:

- Phoenix-aware defaults for common OpenTelemetry primitives
- Automatic configuration from environment variables
- Drop-in replacements for OTel classes with enhanced functionality
- Simplified tracing setup with the `register()` function

## Installation

```bash
pip install arize-phoenix-otel
```

## Quick Start

```python
from phoenix.otel import register

# Simple setup with defaults
tracer_provider = register()

# Advanced configuration
tracer_provider = register(
    project_name="my-project",
    endpoint="https://my-phoenix.com:6006/v1/traces",
    batch=True,
    auto_instrument=True
)
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

The package recognizes these Phoenix-specific environment variables:

- `PHOENIX_COLLECTOR_ENDPOINT`: Collector endpoint URL
- `PHOENIX_PROJECT_NAME`: Project name for spans
- `PHOENIX_CLIENT_HEADERS`: Additional headers for requests
- `PHOENIX_API_KEY`: Authentication key
- `PHOENIX_GRPC_PORT`: gRPC port override

## API Reference

```{toctree}
:maxdepth: 2

api/otel
```

## External Links

- [Main Phoenix Documentation](https://arize.com/docs/phoenix)
- [Python Reference](https://arize-phoenix.readthedocs.io/)
- [GitHub Repository](https://github.com/Arize-ai/phoenix)
- [PyPI Package](https://pypi.org/project/arize-phoenix-otel/) 