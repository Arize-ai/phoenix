---
description: Instrument LLM calls made using the Google ADK Python SDK
---

# Google ADK Tracing

{% embed url="https://google.github.io/adk-docs/observability/phoenix" %}

Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

### Install <a href="#install" id="install"></a>

```bash
pip install openinference-instrumentation-google-adk google-adk arize-phoenix-otel
```

### Setup <a href="#setup" id="setup"></a>

Set the `GOOGLE_API_KEY` environment variable. Refer to Google's [ADK documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/overview) for more details on authentication and environment variables.

```bash
export GOOGLE_API_KEY=[your_key_here]
```

Use the register function to connect your application to Phoenix.

```python
from phoenix.otel import register

# Configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
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

{% hint style="info" %}
Refer to [this page](https://pypi.org/project/openinference-instrumentation-google-adk/#description) for the latest status of the OpenInference Google ADK Instrumentation.
{% endhint %}

### Resources:

* [OpenInference Package](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-google-adk)
