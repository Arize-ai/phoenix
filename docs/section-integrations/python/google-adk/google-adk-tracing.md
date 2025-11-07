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

Set the `GOOGLE_API_KEY` environment variable. Refer to Google's [ADK documentation](https://google.github.io/adk-docs/) for more details on authentication and environment variables.

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

### Agent Engine Deployment

{% hint style="warning" %}
When using **Vertex AI Agent Engine** for remote deployment, instrumentation must be configured **within the remote agent module**, not in the main application code.
{% endhint %}

For Agent Engine deployment, include the instrumentation packages in your requirements and set up instrumentation in your agent module:

**Main Application:**
```python
# Initialize Vertex AI

# Builds instrumentor inside agent engine setup
def build_instrumentor(project_id):
    import os
    from phoenix.otel import register
    from openinference.instrumentation.google_adk import GoogleADKInstrumentor

    # Configure instrumentation within the remote agent
    tracer_provider = register(
        project_name=project_id,
    )
    GoogleADKInstrumentor().instrument(tracer_provider=tracer_provider)


# Configure the agent app
app = vertexai.agent_engines.AdkApp(
    agent=root_agent,
    enable_tracing=True,
    instrumentor_builder=build_instrumentor,
)

remote_agent = agent_engines.create(
    agent_engine=app,
    requirements=[
        "google-cloud-aiplatform[agent_engines,adk]",
        "arize-otel",
        "openinference-instrumentation-google-adk",
    ],
    extra_packages=["adk_agent.py"],
    "env_vars": {
        "OTEL_LOG_LEVEL": "DEBUG",
        "NO_PROXY": "otlp.arize.com",
        "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otlp.arize.com",
        "OTEL_EXPORTER_OTLP_TIMEOUT": "60000",  # 60 seconds,
        "ARIZE_API_KEY": "YOUR_ARIZE_API_KEY",
        "ARIZE_SPACE_ID": "YOUR_ARIZE_SPACE_ID",
    }
)
```

**Agent Module (`adk_agent.py`):**
```python
root_agent = Agent(
   name="test_agent",
   model="gemini-2.0-flash-exp",
   description="Agent to answer questions.",
)
```

### Resources:

* [OpenInference Package](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-google-adk)
* [Google ADK documentation](https://google.github.io/adk-docs/)
* [VertexAI ADK](https://github.com/googleapis/python-aiplatform/blob/main/vertexai/agent_engines/templates/adk.py)
