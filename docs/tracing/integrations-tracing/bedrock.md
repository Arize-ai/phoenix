---
description: >-
  Instrument LLM calls to AWS Bedrock via the boto3 client using the
  BedrockInstrumentor
---

# Bedrock

boto3 provides Python bindings to AWS services, including Bedrock, which provides access to a number of foundation models. Calls to these models can be instrumented using OpenInference, enabling OpenTelemetry-compliant observability of applications built using these models. Traces collected using OpenInference can be viewed in Phoenix.

OpenInference Traces collect telemetry data about the execution of your LLM application. Consider using this instrumentation to understand how a Bedrock-managed models are being called inside a complex system and to troubleshoot issues such as extraction and response synthesis.

## Install

```bash
pip install openinference-instrumentation-bedrock opentelemetry-exporter-otlp
```

## Setup

Set up [OpenTelemetry to point to a running Phoenix Instance](https://docs.arize.com/phoenix/quickstart).

After starting a Phoenix server, instrument `boto3` prior to initializing a `bedrock-runtime` client. All clients created after instrumentation will send traces on all calls to `invoke_model`.

```python
import boto3
from openinference.instrumentation.bedrock import BedrockInstrumentor

BedrockInstrumentor().instrument()

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

## Observe

Now that you have tracing setup, all calls to invoke\_model will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [Example notebook](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-bedrock/examples/bedrock\_example.py)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-bedrock)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-bedrock/examples)

