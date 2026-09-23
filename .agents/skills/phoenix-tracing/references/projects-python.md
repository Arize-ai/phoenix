# Phoenix Tracing: Projects (Python)

**Organize traces by application using projects (Phoenix's top-level grouping).**

## Overview

Projects group traces for a single application or experiment.

**Use for:** Environments (dev/staging/prod), A/B testing, versioning

## Setup

### Environment Variable (Recommended)

```bash
export PHOENIX_PROJECT="my-app-prod"  # PHOENIX_PROJECT_NAME is a supported alias
```

```python
import os
os.environ["PHOENIX_PROJECT"] = "my-app-prod"
from phoenix.otel import register
register()  # Uses "my-app-prod"
```

`PHOENIX_PROJECT` is canonical and takes precedence over the `PHOENIX_PROJECT_NAME`
alias when both are set.

### Code

```python
from phoenix.otel import register
register(project_name="my-app-prod")
```

## Use Cases

**Environments:**

```python
# Dev, staging, prod
register(project_name="my-app-dev")
register(project_name="my-app-staging")
register(project_name="my-app-prod")
```

**A/B Testing:**

```python
# Compare models
register(project_name="chatbot-gpt4")
register(project_name="chatbot-claude")
```

**Versioning:**

```python
# Track versions
register(project_name="my-app-v1")
register(project_name="my-app-v2")
```

## Listing Projects Programmatically

`arize-phoenix-client` exposes a `projects` resource with full CRUD. `list()`
pages through the REST API for you:

```python
from phoenix.client import Client

client = Client()

projects = client.projects.list()
for project in projects:
    print(f"Project name: {project['name']}")

# Filter server-side on a case-insensitive substring of the name
agent_projects = client.projects.list(name_contains="agent")
```

`list()` is keyword-only: `list(*, name_contains: Optional[str] = None) -> list[v1.Project]`.
Each project is a `TypedDict`, so read fields with `project["name"]`, not
`project.name`. `client.projects` also offers `get`, `create`, `update`, and
`delete`.

## Via HTTP Header (OTEL Collector / config-based tools)

If you cannot set resource attributes in code (e.g. when using an OTEL Collector or another configuration-driven pipeline), set the `x-project-name` HTTP header on OTLP HTTP exports. The header takes precedence over the `openinference.project.name` resource attribute; every span in the request is routed to that project.

```bash
# Via OTEL_EXPORTER_OTLP_HEADERS environment variable
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:6006"
export OTEL_EXPORTER_OTLP_HEADERS="x-project-name=my-project"
```

```python
# Using the raw OTLP HTTP exporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

exporter = OTLPSpanExporter(
    endpoint="http://localhost:6006/v1/traces",
    headers={"x-project-name": "my-project"},
)
```

```yaml
# OTEL Collector otlphttp exporter
exporters:
  otlphttp:
    endpoint: "http://phoenix:6006"
    headers:
      x-project-name: "my-project"
```

> **Note:** `x-project-name` is only supported by the **HTTP** OTLP endpoint (`/v1/traces`). For gRPC, use the `openinference.project.name` resource attribute instead.

## Switching Projects (Python Notebooks Only)

```python
from openinference.instrumentation import dangerously_using_project
from phoenix.otel import register

register(project_name="my-app")

# Switch temporarily for evals
with dangerously_using_project("my-eval-project"):
    run_evaluations()
```

**⚠️ Only use in notebooks/scripts, not production.**
