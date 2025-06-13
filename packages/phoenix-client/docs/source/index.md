# Phoenix Client Reference

Welcome to the Phoenix Client Reference documentation. This package provides a lightweight Python client for interacting with the Phoenix platform via its OpenAPI REST interface.

## Installation

Install the Phoenix Client using pip:

```bash
pip install arize-phoenix-client
```

## Quick Start

```python
from phoenix.client import Client

# Connect to your Phoenix server
client = Client(base_url="http://localhost:6006")  # Default Phoenix server URL

# Or connect to Phoenix Cloud or other hosted instances
client = Client(
    base_url="https://your-phoenix-instance.com",
    api_key="your-api-key"
)
```

## Client Resources

The Phoenix Client organizes its functionality into **resources** that correspond to different aspects of the Phoenix platform. Each resource provides methods to interact with specific entities:

### Projects Resource
Access and manage your Phoenix projects:
```python
# List all projects
projects = client.projects.list()

# Get a specific project
project = client.projects.get(project_name="my-project")
```

### Prompts Resource
Manage prompt templates and versions:
```python
# Create a new prompt
prompt = client.prompts.create(
    name="my-prompt",
    version=PromptVersion(...)
)

# Retrieve and use prompts
prompt = client.prompts.get(prompt_identifier="my-prompt")
```

### Spans Resource
Query and analyze trace spans:
```python
# Get spans from a project
spans = client.spans.list(project_name="my-project")
```

### Annotations Resource
Work with human feedback and evaluations:
```python
# Add annotations to spans
client.annotations.create(...)
```

## Authentication

### API Key Authentication
Set your API key via environment variable:
```bash
export PHOENIX_API_KEY="your-api-key"
```

Or pass it directly to the client:
```python
client = Client(api_key="your-api-key")
```

### Custom Headers (Phoenix Cloud)
For Phoenix Cloud or custom authentication:
```bash
export PHOENIX_CLIENT_HEADERS="api-key=your-api-key"
```

Or programmatically:
```python
client = Client(headers={"api-key": "your-api-key"})
```

## External Links

- [Main Phoenix Documentation](https://arize.com/docs/phoenix)
- [Python Reference](https://arize-phoenix.readthedocs.io/)
- [GitHub Repository](https://github.com/Arize-ai/phoenix)

## API Reference

```{toctree}
:maxdepth: 2
:caption: API Reference

api/client
```

## Indices and tables

- {ref}`genindex`
- {ref}`modindex`
- {ref}`search` 