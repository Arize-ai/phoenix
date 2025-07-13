---
description: Instrument LLM calls made using the Google ADK Python SDK
---

# Google ADK Tracing

{% embed url="https://google.github.io/adk-docs/observability/phoenix" %}

Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

### Install <a href="#install" id="install"></a>

```bash
pip install openinference-instrumentation-google-adk google-adk arize-phoenix-otel opentelemetry-sdk opentelemetry-exporter-otlp
```

### Setup <a href="#setup" id="setup"></a>

Set the `GOOGLE_API_KEY` environment variable. Refer to Google's [ADK documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/overview) for more details on authentication and environment variables.

```bash
export GOOGLE_API_KEY=[your_key_here]
```

To enable automatic tracing for Google ADK SDK, initialize the `GoogleADKInstrumentor` and configure the OpenTelemetry tracer to export these traces to Phoenix

```python
from openinference.instrumentation.google_adk import GoogleADKInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))

GoogleADKInstrumentor().instrument(tracer_provider=tracer_provider)
```

### Observe <a href="#observe" id="observe"></a>

Now that you have tracing setup, all Google ADK SDK requests will be streamed to Phoenix for observability and evaluation.

```python
import asyncio

from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner
from google.genai import types

def get_weather(city: str) -> dict:
    """Retrieves the current weather report for a specified city.

    Args:
        city (str): The name of the city for which to retrieve the weather report.

    Returns:
        dict: status and result or error msg.
    """
    if city.lower() == "new york":
        return {
            "status": "success",
            "report": (
                "The weather in New York is sunny with a temperature of 25 degrees"
                " Celsius (77 degrees Fahrenheit)."
            ),
        }
    else:
        return {
            "status": "error",
            "error_message": f"Weather information for '{city}' is not available.",
        }

agent = Agent(
   name="test_agent",
   model="gemini-2.0-flash-exp",
   description="Agent to answer questions using tools.",
   instruction="You must use the available tools to find an answer.",
   tools=[get_weather]
)

async def main():
    app_name = "test_instrumentation"
    user_id = "test_user"
    session_id = "test_session"
    runner = InMemoryRunner(agent=agent, app_name=app_name)
    session_service = runner.session_service
    await session_service.create_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id
    )
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=types.Content(role="user", parts=[
            types.Part(text="What is the weather in New York?")]
        )
    ):
        if event.is_final_response():
            print(event.content.parts[0].text.strip())

if __name__ == "__main__":
    asyncio.run(main())
```

You can now simply run the file:

```python
python your_file_name.py
```

And observe the traces at:

```python
http://localhost:6006/projects
```


{% hint style="info" %}
This instrumentation will support additional features as the Google ADK SDK evolves. Refer to [this page](https://pypi.org/project/openinference-instrumentation-google-adk/#description) for the latest status.
{% endhint %}

### Resources:

* [OpenInference Package](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-google-adk)
