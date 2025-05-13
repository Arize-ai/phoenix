# Agno

## Launch Phoenix

{% include "../../.gitbook/includes/phoenix-startup-for-tracing-integrations.md" %}

## Install

```shell
pip install openinference-instrumentation-agno agno
```

## Setup

Use the register function to connect your application to Phoenix:

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
```

## Run Agno

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.duckduckgo import DuckDuckGoTools

agent = Agent(
    model=OpenAIChat(id="gpt-4o-mini"),
    tools=[DuckDuckGoTools()],
    markdown=True,
    debug_mode=True,
)

agent.run("What is currently trending on Twitter?")
```

## Observe

Now that you have tracing setup, all invocations of Agno agents will be streamed to Phoenix for observability and evaluation.

## Resources

* [OpenInference package](https://pypi.org/project/openinference-instrumentation-agno/)
* [Example](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-agno)
