# Agno Tracing

Phoenix provides seamless observability and tracing for Agno agents through the OpenInference instrumentation package. This integration automatically captures agent interactions, tool usage, reasoning steps, and multi-agent conversations, giving you complete visibility into your Agno applications. Monitor performance, debug issues, and evaluate agent behavior in real-time as your agents execute complex workflows and collaborate in teams.

Agno is a lightweight, high-performance Python framework for building AI agents with tools, memory, and reasoning capabilities. It enables developers to create autonomous agents that can perform complex tasks, access knowledge bases, and collaborate in multi-agent teams. With support for 23+ model providers and lightning-fast performance (\~3μs instantiation), Agno is designed for production-ready AI applications.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/agno-example-trace.png" %}
Agno Traces in Phoenix
{% endembed %}

## Key Features

* **Model Agnostic**: Connect to OpenAI, Anthropic, Google, and 20+ other providers
* **Lightning Fast**: Agents instantiate in \~3μs with minimal memory footprint
* **Built-in Reasoning**: First-class support for chain-of-thought and reasoning models
* **Multi-Modal**: Native support for text, image, audio, and video processing
* **Agentic RAG**: Advanced retrieval-augmented generation with hybrid search
* **Multi-Agent Teams**: Coordinate multiple agents for complex workflows
* **Production Ready**: Pre-built FastAPI routes and monitoring capabilities

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

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
