---
description: How to use the python PydanticAIInstrumentor to trace PydanticAI agents
---

# Pydantic AI Tracing

[PydanticAI](https://ai.pydantic.dev/) is a Python agent framework designed to make it less painful to build production-grade applications with Generative AI. Built by the team behind Pydantic, it provides a clean, type-safe way to build AI agents with structured outputs.

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

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

# If you are using a local instance without auth, ignore these headers
headers = {"Authorization": f"Bearer {os.environ['PHOENIX_API_KEY']}"}
exporter = OTLPSpanExporter(endpoint=endpoint, headers=headers)

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
