# Overview

## Features

* [**API**](https://arize-phoenix.readthedocs.io/en/latest/) - Interact with Phoenix's OpenAPI REST interface
  * [Session](https://arize-phoenix.readthedocs.io/en/latest/api/session.html) - Methods for loading, inspecting, and interacting with tracing and evaluation sessions
  * [Client](https://arize-phoenix.readthedocs.io/en/latest/api/client.html) - Upload and download data to and from Phoenix
  * [Evals](https://arize-phoenix.readthedocs.io/en/latest/api/evals.html) - Define and run evaluations across models, traces, or datasets
  * [Experiments](https://arize-phoenix.readthedocs.io/en/latest/api/experiments.html) - Track, evaluate, and compare multiple runs under different conditions
  * [Otel](https://arize-phoenix.readthedocs.io/en/latest/api/otel.html) - Integrate tracing and metrics using OpenTelemetry for automatic or manual instrumentation
  * [Inferences / Schema](https://arize-phoenix.readthedocs.io/en/latest/api/inferences_schema.html) - Transform spans and evaluations into datasets, define structures for features and predictions, and manage embedding columns
* [**Prompt Management** ](./#prompt-management)- Pull, push, and invoke prompts stored in Phoenix
* [**Project Management**](./#project-management) - Create, read, update, and delete projects in Phoenix

## Installation

Install via `pip`.

```shell
pip install -Uq arize-phoenix-client
```

## Usage

```python
from phoenix.client import Client

client = Client(base_url="your-server-url")  # base_url defaults to http://localhost:6006
```

### Authentication (if applicable)

Phoenix API key can be an environment variable...

```python
import os

os.environ["PHOENIX_API_KEY"] = "your-api-key"
```

...or passed directly to the client.

```python
from phoenix.client import Client

client = Client(api_key="your-api-key")
```

### Custom Headers

By default, the Phoenix client will use the bearer authentication scheme in the HTTP headers, but if you need different headers, e.g. for Phoenix Cloud, they can also be customized via an environment variable...

```python
import os

os.environ["PHOENIX_CLIENT_HEADERS"] = "api-key=your-api-key,"  # use `api-key` for Phoenix Cloud
```

...or passed directly to the client.

```python
from phoenix.client import Client

client = Client(headers={"api-key": "your-api-key"})  # use `api-key` for Phoenix Cloud
```

## Prompt Management

With the Phoenix client, you can push and pull prompts to and from your Phoenix server.

```python
from phoenix.client import Client
from phoenix.client.types import PromptVersion

# Change base_url to your Phoenix server URL
base_url = "http://localhost:6006"
client = Client(base_url=base_url)

# prompt identifier consists of alphanumeric characters, hyphens or underscores
prompt_identifier = "haiku-writer"

content = "Write a haiku about {{topic}}"
prompt = client.prompts.create(
    name=prompt_identifier,
    version=PromptVersion(
        [{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
    ),
)
```

The client can retrieve a prompt by its name.

```python
prompt = client.prompts.get(prompt_identifier=prompt_identifier)
```

The prompt can be used to generate completions.

```python
from openai import OpenAI

variables = {"topic": "programming"}
resp = OpenAI().chat.completions.create(**prompt.format(variables=variables))
print(resp.choices[0].message.content)
```

To learn more about prompt engineering using Phenix, see the [Phoenix documentation](https://arize.com/docs/phoenix/prompt-engineering/how-to-prompts).

## Project Management

The Phoenix client provides synchronous and asynchronous interfaces for interacting with Phoenix Projects.

### Key Features

* **Get** a project by ID or name
* **List** all projects
* **Create a new project with optional description**
* **Update** a project’s description (note: names cannot be changed)
* **Delete** a project by ID or name

### Usage Examples

```python
from phoenix.client import Client
client = Client(base_url="your-server-url")

# List all projects
projects = client.projects.list()

# Get a project by ID or name
project = client.projects.get(project_id="UHJvamVjdDoy")
project = client.projects.get(project_name="My Project")

# Create a project
new_project = client.projects.create(
    name="New Project",
    description="This is a new project"
)

# Update a project
updated_project = client.projects.update(
    project_id="UHJvamVjdDoy",
    description="Updated description"
)

# Delete a project
client.projects.delete(project_name="My Project")
```
