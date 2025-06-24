# LangGraph Tracing

Phoenix has first-class support for [LangGraph](https://www.langchain.com/langgraph) applications.

{% hint style="info" %}
LangGraph is supported by our LangChain instrumentor. If you've already set up instrumentation with LangChain, you don't need to complete the set up below
{% endhint %}

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

```bash
pip install openinference-instrumentation-langchain
```

Install the OpenInference Langchain library before your application code. Our LangChainInstrumentor works for both standard LangChain applications and for LangGraph agents.

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

## Run LangGraph

By instrumenting LangGraph, spans will be created whenever an agent is invoked and will be sent to the Phoenix server for collection.

## Observe

Now that you have tracing setup, all invocations of chains will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [Example notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/langgraph_agent_tracing_tutorial.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-langchain)
* [Blog walkthrough](https://arize.com/blog/langgraph/)
