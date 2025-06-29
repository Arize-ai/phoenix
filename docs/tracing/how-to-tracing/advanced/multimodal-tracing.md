# Capture Multimodal Traces

Phoenix supports displaying images that are included in LLM traces.

<figure><img src="https://arize.com/wp-content/uploads/2024/08/multimodal_gallery.gif" alt=""><figcaption></figcaption></figure>

## To view images in Phoenix

1. [Connect to a Phoenix instance](../../../quickstart.md)
2. [Instrument your application](broken-reference)
3. Include either a base64 UTF-8 encoded image or an image url in the call made to your LLM

## Example

```bash
pip install -q "arize-phoenix>=4.29.0" openinference-instrumentation-openai openai
```

```python
# Check if PHOENIX_API_KEY is present in the environment variables.
# If it is, we'll use the cloud instance of Phoenix. If it's not, we'll start a local instance.
# A third option is to connect to a docker or locally hosted instance.
# See https://arize.com/docs/phoenix/setup/environments for more information.

# Launch Phoenix
import os
if "PHOENIX_API_KEY" in os.environ:
    os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={os.environ['PHOENIX_API_KEY']}"
    os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

else:
    import phoenix as px

    px.launch_app().view()

# Connect to Phoenix
from phoenix.otel import register
tracer_provider = register()

# Instrument OpenAI calls in your application
from openinference.instrumentation.openai import OpenAIInstrumentor
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider, skip_dep_check=True)

# Make a call to OpenAI with an image provided
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
  model="gpt-4o",
  messages=[
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What’s in this image?"},
        {
          "type": "image_url",
          "image_url": {
            "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
          },
        },
      ],
    }
  ],
  max_tokens=300,
)
```

You should see your image appear in Phoenix:

<figure><img src="../../../.gitbook/assets/image-trace.png" alt=""><figcaption></figcaption></figure>
