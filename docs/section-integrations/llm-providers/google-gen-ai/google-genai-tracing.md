---
description: Instrument LLM calls made using the Google Gen AI Python SDK
---

# Google Gen AI Tracing

### Launch Phoenix <a href="#launch-phoenix" id="launch-phoenix"></a>

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

### Install <a href="#install" id="install"></a>

```bash
pip install openinference-instrumentation-google-genai google-genai
```

### Setup <a href="#setup" id="setup"></a>

Set the `GEMINI_API_KEY` environment variable. To use the Gen AI SDK with Vertex AI instead of the Developer API, refer to Google's [guide](https://cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview) on setting the required environment variables.

```python
export GEMINI_API_KEY=[your_key_here]
```

Use the register function to connect your application to Phoenix.

```python
from phoenix.otel import register
​
# Configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
```

### Observe <a href="#observe" id="observe"></a>

Now that you have tracing setup, all Gen AI SDK requests will be streamed to Phoenix for observability and evaluation.

```python
import os
from google import genai
​
def send_message_multi_turn() -> tuple[str, str]:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    chat = client.chats.create(model="gemini-2.0-flash-001")
    response1 = chat.send_message("What is the capital of France?")
    response2 = chat.send_message("Why is the sky blue?")
​
    return response1.text or "", response2.text or ""
```

{% hint style="info" %}
This instrumentation will support tool calling soon. Refer to [this page](https://pypi.org/project/openinference-instrumentation-google-genai/#description) for the status.
{% endhint %}
