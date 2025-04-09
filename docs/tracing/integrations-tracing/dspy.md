---
description: Instrument and observe your DSPy application via the DSPyInstrumentor
---

# DSPy

[DSPy](https://github.com/stanfordnlp/dspy) is a framework for automatically prompting and fine-tuning language models. It provides composable and declarative APIs that allow developers to describe the architecture of their LLM application in the form of a "module" (inspired by PyTorch's `nn.Module`). It them compiles these modules using "teleprompters" that optimize the module for a particular task. The term "teleprompter" is meant to evoke "prompting at a distance," and could involve selecting few-shot examples, generating prompts, or fine-tuning language models.

Phoenix makes your DSPy applications observable by visualizing the underlying structure of each call to your compiled DSPy module.

## Launch Phoenix

{% tabs %}
{% tab title="Phoenix Cloud" %}
**Sign up for Phoenix:**

Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint and API Key:**

```python
import os

# Add Phoenix API Key for tracing
PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
```

Your **Phoenix API key** can be found on the Keys section of your [dashboard](https://app.phoenix.arize.com).
{% endtab %}

{% tab title="Command Line" %}
**Launch your local Phoenix instance:**

```bash
pip install arize-phoenix
phoenix serve
```

For details on customizing a local terminal deployment, see [Terminal Setup](https://docs.arize.com/phoenix/setup/environments#terminal).

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint:**

```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"
```

See [Broken link](broken-reference "mention") for more details
{% endtab %}

{% tab title="Docker" %}
**Pull latest Phoenix image from** [**Docker Hub**](https://hub.docker.com/r/arizephoenix/phoenix)**:**

```bash
docker pull arizephoenix/phoenix:latest
```

**Run your containerized instance:**

```bash
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

This will expose the Phoenix on `localhost:6006`

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint:**

```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"
```

For more info on using Phoenix with Docker, see [Docker](https://docs.arize.com/phoenix/self-hosting/deployment-options/docker).
{% endtab %}

{% tab title="Notebook" %}
**Install packages:**

```bash
pip install arize-phoenix
```

**Launch Phoenix:**

```python
import phoenix as px
px.launch_app()
```

{% hint style="info" %}
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [self-hosting](https://docs.arize.com/phoenix/self-hosting) or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}
{% endtabs %}

## Install

```bash
pip install openinference-instrumentation-dspy openinference-instrumentation-litellm dspy
```

{% hint style="info" %}
DSPy uses LiteLLM under the hood to make some calls. By adding the OpenInference library for LiteLLM, you'll be able to see additional information like token counts on your traces.
{% endhint %}

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

## Run DSPy

Now run invoke your compiled DSPy module. Your traces should appear inside of Phoenix.

```python
class BasicQA(dspy.Signature):
    """Answer questions with short factoid answers."""

    question = dspy.InputField()
    answer = dspy.OutputField(desc="often between 1 and 5 words")


if __name__ == "__main__":
    turbo = dspy.OpenAI(model="gpt-3.5-turbo")

    dspy.settings.configure(lm=turbo)

    with using_attributes(
        session_id="my-test-session",
        user_id="my-test-user",
        metadata={
            "test-int": 1,
            "test-str": "string",
            "test-list": [1, 2, 3],
            "test-dict": {
                "key-1": "val-1",
                "key-2": "val-2",
            },
        },
        tags=["tag-1", "tag-2"],
        prompt_template_version="v1.0",
        prompt_template_variables={
            "city": "Johannesburg",
            "date": "July 11th",
        },
    ):
        # Define the predictor.
        generate_answer = dspy.Predict(BasicQA)

        # Call the predictor on a particular input.
        pred = generate_answer(
            question="What is the capital of the united states?"  # noqa: E501
        )  # noqa: E501
        print(f"Predicted Answer: {pred.answer}")
```

## Observe

Now that you have tracing setup, all predictions will be streamed to your running Phoenix for observability and evaluation.

![Traces and spans from an instrumented DSPy custom module.](https://storage.googleapis.com/arize-phoenix-assets/assets/docs/notebooks/dspy-tracing-tutorial/dspy_spans_and_traces.gif)

## Resources

* [Example notebook](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/dspy_tracing_tutorial.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-dspy)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/python/examples/dspy-rag-fastapi)
