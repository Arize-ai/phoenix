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
        arize-phoenix-client
    </div>
</h1>

Phoenix Client is a lightweight package for interacting with the Phoenix server.

[![pypi](https://badge.fury.io/py/arize-phoenix-client.svg)](https://pypi.org/project/arize-phoenix-client/)

## Features

- **API** - Interact with Phoenix's OpenAPI REST interface
- **Prompt Management** - Pull / push / and invoke prompts stored in Phoenix

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

### Prompt Management

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
