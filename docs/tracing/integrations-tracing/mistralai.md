---
description: Instrument LLM calls made using MistralAI's SDK via the MistralAIInstrumentor
---

# MistralAI

MistralAI is a leading provider for state-of-the-art LLMs. The MistralAI SDK can be instrumented using the [`openinference-instrumentation-mistralai`](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-mistralai) package.

## Install

```bash
pip install openinference-instrumentation-mistralai mistralai
```

## Setup

Set the `MISTRAL_API_KEY` environment variable to authenticate calls made using the SDK.

```
export MISTRAL_API_KEY=[your_key_here]
```

Set up [OpenTelemetry to point to a running Phoenix Instance](https://docs.arize.com/phoenix/quickstart) and then initialize the MistralAIInstrumentor before your application code.

```python
from openinference.instrumentation.mistralai import MistralAIInstrumentor

MistralAIInstrumentor().instrument()
```

## Run Mistral

```python
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage

client = MistralClient()
response = client.chat(
    model="mistral-large-latest",
    messages=[
        ChatMessage(
            content="Who won the World Cup in 2018?",
            role="user",
        )
    ],
)
print(response.choices[0].message.content)

```

## Observe

Now that you have tracing setup, all invocations of Mistral (completions, chat completions, embeddings) will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [Example notebook](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-mistralai/examples/chat\_completions.py)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-mistralai)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-mistralai/examples)
