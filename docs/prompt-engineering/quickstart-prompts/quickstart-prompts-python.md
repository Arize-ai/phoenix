---
description: >-
  This guide will show you how to setup and use Prompts through Phoenix's Python
  SDK
---

# Quickstart: Prompts (Python)

{% embed url="https://youtu.be/qbeohWaRlsM?si=5XL5cF9VoeckKG4q" %}

## Installation

Start out by installing the Phoenix library:

```bash
pip install arize-phoenix-client openai
```

## Connect to Phoenix

You'll need to specify your Phoenix endpoint before you can interact with the Client. The easiest way to do this is through an environment variable.

```python
import os

# If you're self-hosting Phoenix, change this value:
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

PHOENIX_API_KEY = enter your api key
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
```

## Creating a Prompt

Now you can create a prompt. In this example, you'll create a summarization Prompt.

Prompts in Phoenix have **names**, as well as multiple **versions**. When you create your prompt, you'll define its name. Then, each time you update your prompt, that will create a new version of the prompt under the same name.

```python
from phoenix.client import Client
from phoenix.client.types import PromptVersion

content = """
You're an expert educator in {{ topic }}. Summarize the following article
in a few concise bullet points that are easy for beginners to understand.

{{ article }}
"""

prompt_name = "article-bullet-summarizer"
prompt = Client().prompts.create(
    name=prompt_name,
    prompt_description="Summarize an article in a few bullet points",
    version=PromptVersion(
        [{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
    ),
)
```

Your prompt will now appear in your Phoenix dashboard:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompts-python-qs-1.png" %}



## Retrieving a Prompt

You can retrieve a prompt by name, tag, or version:

```python
from phoenix.client import Client

client = Client()

# Pulling a prompt by name
prompt_name = "article-bullet-summarizer"
client.prompts.get(prompt_identifier=prompt_name)

# Pulling a prompt by version id
# The version ID can be found in the versions tab in the UI
prompt = client.prompts.get(prompt_version_id="UHJvbXB0VmVyc2lvbjoy")

# Pulling a prompt by tag
# Since tags don't uniquely identify a prompt version 
#  it must be paired with the prompt identifier (e.g. name)
prompt = client.prompts.get(prompt_identifier=prompt_name, tag="staging")
```

## Using a Prompt

To use a prompt, call the `prompt.format()`function. Any `{{ variables }}`  in the prompt can be set by passing in a dictionary of values.

```python
from openai import OpenAI

prompt_vars = {"topic": "Sports", "article": "Surrey have signed Australia all-rounder Moises Henriques for this summer's NatWest T20 Blast. Henriques will join Surrey immediately after the Indian Premier League season concludes at the end of next month and will be with them throughout their Blast campaign and also as overseas cover for Kumar Sangakkara - depending on the veteran Sri Lanka batsman's Test commitments in the second half of the summer. Australian all-rounder Moises Henriques has signed a deal to play in the T20 Blast for Surrey . Henriques, pictured in the Big Bash (left) and in ODI action for Australia (right), will join after the IPL . Twenty-eight-year-old Henriques, capped by his country in all formats but not selected for the forthcoming Ashes, said: 'I'm really looking forward to playing for Surrey this season. It's a club with a proud history and an exciting squad, and I hope to play my part in achieving success this summer. 'I've seen some of the names that are coming to England to be involved in the NatWest T20 Blast this summer, so am looking forward to testing myself against some of the best players in the world.' Surrey director of cricket Alec Stewart added: 'Moises is a fine all-round cricketer and will add great depth to our squad.'"}
formatted_prompt = prompt.format(variables=prompt_vars)

# Make a request with your Prompt
oai_client = OpenAI()
resp = oai_client.chat.completions.create(**formatted_prompt)
```

## Updating a Prompt

To update a prompt with a new version, simply call the create function using the existing prompt name:

```python
content = """
You're an expert educator in {{ topic }}. Summarize the following article
in a few concise bullet points that are easy for beginners to understand.

Be sure not to miss any key points.

{{ article }}
"""

prompt_name = "article-bullet-summarizer"
prompt = Client().prompts.create(
    name=prompt_name,
    prompt_description="Summarize an article in a few bullet points",
    version=PromptVersion(
        [{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
    ),
)
```

The new version will appear in your Phoenix dashboard:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompts-python-qs-2.png" %}

Congratulations! You can now create, update, access and use prompts using the Phoenix SDK!

## Next Steps

From here, check out:

* How to use your prompts in [Prompt Playground](../overview-prompts/prompt-playground.md)
* Prompt iteration [Use Cases](../use-cases-prompts.md)
