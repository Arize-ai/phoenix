# Phoenix Client Reference

Welcome to the Phoenix Client Reference documentation. This package provides a lightweight Python client for interacting with the Phoenix platform via its OpenAPI REST interface.

## Installation

Install the Phoenix Client using pip:

```bash
pip install arize-phoenix-client
```

## API Reference

```{toctree}
:maxdepth: 3
:caption: API Reference

api/client
```

## Getting Started

### Environment Variables
Configure Phoenix Client using environment variables for easier deployment:

```bash
# For local Phoenix server (default)
export PHOENIX_BASE_URL="http://localhost:6006"

# Cloud Instance
export PHOENIX_API_KEY="your-api-key"
export PHOENIX_BASE_URL="https://app.phoenix.arize.com/s/your-space"

# For custom Phoenix instances with API key authentication
export PHOENIX_BASE_URL="https://your-phoenix-instance.com"
export PHOENIX_API_KEY="your-api-key"

# Customize headers
export PHOENIX_CLIENT_HEADERS="Authorization=Bearer your-api-key,custom-header=value"
```

### Client Initialization
The client automatically reads environment variables, or you can override them:

```python
from phoenix.client import Client

# Automatic configuration from environment variables
client = Client()  # Uses PHOENIX_BASE_URL, PHOENIX_API_KEY, PHOENIX_CLIENT_HEADERS

# Override environment variables
client = Client(base_url="http://localhost:6006")  # Local Phoenix server

# Explicit API key
client = Client(
    base_url="https://app.phoenix.arize.com/s/your-space",
    api_key="your-api-key"
)

# Custom headers for authentication
client = Client(
    base_url="https://your-phoenix-instance.com",
    headers={"Authorization": "Bearer your-api-key"}
)

# Asynchronous Client
async_client = AsyncClient()  # Uses environment variables

# Override environment variables for async client
async_client = AsyncClient(base_url="http://localhost:6006")

# Cloud instance
async_client = AsyncClient(
    base_url="https://app.phoenix.arize.com/s/your-space",
    api_key="your-api-key"
)
```

## Recources

The Phoenix Client organizes its functionality into **resources** that correspond to different aspects of the Phoenix platform. Each resource provides methods to interact with specific entities:

### Prompts
Manage prompt templates and versions:
```python
# Create a new prompt
from phoenix.client import Client
from phoenix.client.types import PromptVersion

content = """
You're an expert educator in {{ topic }}. Summarize the following article
in a few concise bullet points that are easy for beginners to understand.

{{ article }}
"""

prompt = client.prompts.create(
    name="article-bullet-summarizer",
    version=PromptVersion(
        messages=[{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
    ),
    prompt_description="Summarize an article in a few bullet points",
)

# Retrieve and use prompts
prompt = client.prompts.get(prompt_identifier="article-bullet-summarizer")

# Format the prompt with variables
prompt_vars = {
    "topic": "Sports",
    "article": "Moises Henriques, the Australian all-rounder, has signed to play for Surrey in this summer's NatWest T20 Blast. He will join after the IPL and is expected to strengthen the squad throughout the campaign."
}
formatted_prompt = prompt.format(variables=prompt_vars)

# Make a request with your Prompt using OpenAI
from openai import OpenAI
oai_client = OpenAI()
resp = oai_client.chat.completions.create(**formatted_prompt)
print(resp.choices[0].message.content)
```

### Spans
Query and analyze trace spans:
```python
# Get spans from a project
spans = client.spans.list(project_name="my-project")
```

### Annotations
Work with human feedback and evaluations:
```python
# Add annotations to spans
client.annotations.create(...)
```

### Projects
Access and manage your Phoenix projects:
```python
# List all projects
projects = client.projects.list()

# Get a specific project
project = client.projects.get(project_name="my-project")
```
## External Links

- [Main Phoenix Documentation](https://arize.com/docs/phoenix)
- [Python Reference](https://arize-phoenix.readthedocs.io/)
- [GitHub Repository](https://github.com/Arize-ai/phoenix)

## Indices and tables

- {ref}`genindex`
- {ref}`modindex`
- {ref}`search` 