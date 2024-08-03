---
description: How to use the python LangChainInstrumentor to trace LangChain and LangGraph
---

# LangChain

Phoenix has first-class support for [LangChain](https://langchain.com/) applications.

## Install

```bash
pip install openinference-instrumentation-langchain
```

## Setup

Set up [OpenTelemetry to point to a running Phoenix Instance](https://docs.arize.com/phoenix/quickstart) and then initialize the LangchainInstrumentor before your application code.

```python
from openinference.instrumentation.langchain import LangChainInstrumentor

LangChainInstrumentor().instrument()
```

## Run LangChain

By instrumenting LangChain, spans will be created whenever a a chain is run and will be sent to the Phoenix server for collection.

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

* [Example notebook](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/langchain\_tracing\_tutorial.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-langchain)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-langchain/examples)
