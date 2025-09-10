---
description: How to use the python LangChainInstrumentor to trace LangChain
---

# LangChain Tracing

Phoenix has first-class support for [LangChain](https://langchain.com/) applications.

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

```bash
pip install openinference-instrumentation-langchain langchain_openai
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

## Run LangChain

By instrumenting LangChain, spans will be created whenever a chain is run and will be sent to the Phoenix server for collection.

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

prompt = ChatPromptTemplate.from_template("{x} {y} {z}?").partial(x="why is", z="blue")
chain = prompt | ChatOpenAI(model_name="gpt-3.5-turbo")
chain.invoke(dict(y="sky"))
```

## Observe

Now that you have tracing setup, all invocations of chains will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [Example notebook](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/langchain_tracing_tutorial.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-langchain)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-langchain/examples)
