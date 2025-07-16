# AutoGen Tracing

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/autogen_tutorial.ipynb" %}

AutoGen is an agent framework from Microsoft that allows for complex Agent creation. It is unique in its ability to create multiple agents that work together.

The AutoGen Agent framework allows creation of multiple agents and connection of those agents to work together to accomplish tasks.

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

Phoenix instruments Autogen by instrumenting the underlying model library it's using. If your agents are set up to call OpenAI, use our OpenAI instrumentor per the example below.

If your agents are using a different model, be sure to instrument that model instead by installing its respective OpenInference library.

```shell
pip install openinference-instrumentation-openai arize-phoenix-otel arize-phoenix
```

## Setup

Connect to your Phoenix instance using the register function.

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
```

## Run Autogen

From here you can use Autogen as normal, and Phoenix will automatically trace any model calls made.

## Observe

The Phoenix support is simple in its first incarnation but allows for capturing all of the prompt and responses that occur under the framework between each agent.

The individual prompt and responses are captured directly through OpenAI calls. If you're using a different underlying model provider than OpenAI, instrument your application using the respective instrumentor instead.

## Resources:

* [Example notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/autogen_tutorial.ipynb)
