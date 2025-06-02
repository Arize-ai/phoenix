---
description: How to use the python PydanticAIInstrumentor to trace PydanticAI agents
---

# Pydantic AI Tracing

[PydanticAI](https://ai.pydantic.dev/) is a Python agent framework designed to make it less painful to build production-grade applications with Generative AI. Built by the team behind Pydantic, it provides a clean, type-safe way to build AI agents with structured outputs.

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

For details on customizing a local terminal deployment, see [Terminal Setup](https://arize.com/docs/phoenix/setup/environments#terminal).

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint:**

```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"
```

See Terminal for more details
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

For more info on using Phoenix with Docker, see [Docker](https://arize.com/docs/phoenix/self-hosting/deployment-options/docker).
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
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [self-hosting](https://arize.com/docs/phoenix/self-hosting) or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}
{% endtabs %}

## Install

```bash
pip install openinference-instrumentation-pydantic-ai pydantic-ai opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-api
```

## Setup

Set up tracing using OpenTelemetry and the PydanticAI instrumentation:

```python
import os
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from openinference.instrumentation.pydantic_ai import OpenInferenceSpanProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

# Set up the tracer provider
tracer_provider = TracerProvider()
trace.set_tracer_provider(tracer_provider)

# Add the OpenInference span processor
endpoint = f"{os.environ['PHOENIX_COLLECTOR_ENDPOINT']}/v1/traces"
exporter = OTLPSpanExporter(endpoint=endpoint)
tracer_provider.add_span_processor(OpenInferenceSpanProcessor())
tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
```

## Basic Usage

Here's a simple example using PydanticAI with automatic tracing:

```python
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
import nest_asyncio
nest_asyncio.apply()

# Set your OpenAI API key
os.environ["OPENAI_API_KEY"] = "YOUR_OPENAI_API_KEY"

# Define your Pydantic model
class LocationModel(BaseModel):
    city: str
    country: str

# Create and configure the agent
model = OpenAIModel("gpt-4", provider='openai')
agent = Agent(model, output_type=LocationModel, instrument=True)

# Run the agent
result = agent.run_sync("The windy city in the US of A.")
print(result)
```

## Advanced Usage

### Agent with System Prompts and Tools

```python
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel
from typing import List
import httpx

class WeatherInfo(BaseModel):
    location: str
    temperature: float = Field(description="Temperature in Celsius")
    condition: str
    humidity: int = Field(description="Humidity percentage")

# Create an agent with system prompts and tools
weather_agent = Agent(
    model=OpenAIModel("gpt-4"),
    output_type=WeatherInfo,
    system_prompt="You are a helpful weather assistant. Always provide accurate weather information.",
    instrument=True
)

@weather_agent.tool
async def get_weather_data(ctx: RunContext[None], location: str) -> str:
    """Get current weather data for a location."""
    # Mock weather API call - replace with actual weather service
    async with httpx.AsyncClient() as client:
        # This is a placeholder - use a real weather API
        mock_data = {
            "temperature": 22.5,
            "condition": "partly cloudy",
            "humidity": 65
        }
        return f"Weather in {location}: {mock_data}"

# Run the agent with tool usage
result = weather_agent.run_sync("What's the weather like in Paris?")
print(result)
```

## Observe

Now that you have tracing setup, all PydanticAI agent operations will be streamed to your running Phoenix instance for observability and evaluation. You'll be able to see:

* **Agent interactions**: Complete conversations between your application and the AI model
* **Structured outputs**: Pydantic model validation and parsing results
* **Tool usage**: When agents call external tools and their responses
* **Performance metrics**: Response times, token usage, and success rates
* **Error handling**: Validation errors, API failures, and retry attempts
* **Multi-agent workflows**: Complex interactions between multiple agents

The traces will provide detailed insights into your AI agent behaviors, making it easier to debug issues, optimize performance, and ensure reliability in production.

## Resources

* [OpenInference PydanticAI package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-pydantic-ai)
* [PydanticAI Examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-pydantic-ai/examples)
