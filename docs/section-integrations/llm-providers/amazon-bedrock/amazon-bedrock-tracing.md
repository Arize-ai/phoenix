---
description: >-
  Instrument LLM calls to AWS Bedrock via the boto3 client using the
  BedrockInstrumentor
---

# Amazon Bedrock Tracing

boto3 provides Python bindings to AWS services, including Bedrock, which provides access to a number of foundation models. Calls to these models can be instrumented using OpenInference, enabling OpenTelemetry-compliant observability of applications built using these models. Traces collected using OpenInference can be viewed in Phoenix.

OpenInference Traces collect telemetry data about the execution of your LLM application. Consider using this instrumentation to understand how a Bedrock-managed models are being called inside a complex system and to troubleshoot issues such as extraction and response synthesis.

## Launch Phoenix

## Install

```bash
pip install openinference-instrumentation-bedrock opentelemetry-exporter-otlp
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

After connecting to your Phoenix server, instrument `boto3` prior to initializing a `bedrock-runtime` client. All clients created after instrumentation will send traces on all calls to `invoke_model`.

```python
import boto3

session = boto3.session.Session()
client = session.client("bedrock-runtime")
```

## Run Bedrock

From here you can run Bedrock as normal

```python
prompt = (
    b'{"prompt": "Human: Hello there, how are you? Assistant:", "max_tokens_to_sample": 1024}'
)
response = client.invoke_model(modelId="anthropic.claude-v2", body=prompt)
response_body = json.loads(response.get("body").read())
print(response_body["completion"])
```

{% hint style="warning" %}
⚠️ **Warning: Use `converse` instead of `invoke_model` for Meta models on Amazon Bedrock.**\
Outputs from Meta models (such as **Llama 3**) are not currently traced when using the `invoke_model` API.\
This issue is known, and a fix is actively in progress.
{% endhint %}

## Observe

Now that you have tracing setup, all calls to `invoke_model` will be streamed to your running Phoenix for observability and evaluation.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/bedrock_tracing_eval_medium.gif" %}

## Resources

* [Example Tracing & Eval Notebook](https://colab.research.google.com/github/Arize-ai/phoenix/blob/c02f0e7d807129952afa5da430299aec32fafcc9/tutorials/evals/bedrock_tracing_and_evals_tutorial.ipynb#L24)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-bedrock)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-bedrock/examples)
