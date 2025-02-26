# arize-phoenix-client

Phoenix Client is a lightweight package for interacting with the Phoenix server via its OpenAPI REST interface.

[![pypi](https://badge.fury.io/py/arize-phoenix-client.svg)](https://pypi.org/project/arize-phoenix-client/)

## Installation

Install the package via `pip`.

```shell
pip install -Uq arize-phoenix-client
```

## Usage

### LLM Prompt Management

Here is an example for storing a prompt on the Phoenix server.

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

The client cas also retrieve the prompt via its name.

```python
prompt = client.prompts.get(prompt_identifier=prompt_identifier)
```

The retrieved prompt can be used to generate completions locally.

```python
from openai import OpenAI

variables = {"topic": "programming"}
resp = OpenAI().chat.completions.create(**prompt.format(variables=variables))
print(resp.choices[0].message.content)
```

To learn more about prompt engineering using Phenix, see the [Phoenix documentation](https://docs.arize.com/phoenix/prompt-engineering/how-to-prompts).
