---
description: How to use the SmolagentsInstrumentor to trace smolagents by Hugging Face
---

# smolagents Tracing

smolagents is a minimalist AI agent framework developed by Hugging Face, designed to simplify the creation and deployment of powerful agents with just a few lines of code. It focuses on simplicity and efficiency, making it easy for developers to leverage large language models (LLMs) for various applications.

Phoenix provides auto-instrumentation, allowing you to track and visualize every step and call made by your agent.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/smolagents_tracing_tutorial.ipynb" %}

## Launch Phoenix

We have several code samples below on different ways to integrate with smolagents, based on how you want to use Phoenix.

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

```bash
pip install openinference-instrumentation-smolagents smolagents
```

## Setup

Add your `HF_TOKEN` as an environment variable:

```python
os.environ["HF_TOKEN"] = "<your_hf_token_value>"
```

Connect to your Phoenix instance using the register function.

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
```

## Create & Run an Agent

Create your Hugging Face Model, and at every run, traces will be sent to Phoenix.

```python
from smolagents import (
    CodeAgent,
    InferenceClientModel,
    ToolCallingAgent,
    VisitWebpageTool,
    WebSearchTool,
)

model = InferenceClientModel()

managed_agent = ToolCallingAgent(
    tools=[DuckDuckGoSearchTool(), VisitWebpageTool()],
    model=model,
    name="managed_agent",
    description="This is an agent that can do web search.",
)
manager_agent.run("Based on the latest news, what is happening in extraterrestrial life?")
```

## Observe

Now that you have tracing setup, all invocations and steps of your Agent will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [OpenInference package](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-smolagents)
* [Working examples](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-smolagents/examples)
* [Smolagents Tracing Documentation](https://huggingface.co/docs/smolagents/en/tutorials/inspect_runs)
