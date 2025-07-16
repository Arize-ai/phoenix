---
description: Instrument and observe your DSPy application via the DSPyInstrumentor
---

# DSPy Tracing

[DSPy](https://github.com/stanfordnlp/dspy) is a framework for automatically prompting and fine-tuning language models. It provides composable and declarative APIs that allow developers to describe the architecture of their LLM application in the form of a "module" (inspired by PyTorch's `nn.Module`). It them compiles these modules using "teleprompters" that optimize the module for a particular task. The term "teleprompter" is meant to evoke "prompting at a distance," and could involve selecting few-shot examples, generating prompts, or fine-tuning language models.

Phoenix makes your DSPy applications observable by visualizing the underlying structure of each call to your compiled DSPy module.

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

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
