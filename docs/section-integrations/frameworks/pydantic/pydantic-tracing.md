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

For details on customizing a local terminal deployment, see [Terminal Setup](https://docs.arize.com/phoenix/setup/environments#terminal).

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

For more info on using Phoenix with Docker, see [Docker](https://docs.arize.com/phoenix/self-hosting/deployment-options/docker).
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
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [self-hosting](https://docs.arize.com/phoenix/self-hosting) or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}
{% endtabs %}

## Install

```bash
pip install openinference-instrumentation-pydantic-ai pydantic-ai
```

## Setup

Set up tracing using OpenTelemetry and the PydanticAI instrumentation:

```python
# Add the PydanticAI instrumentor
PydanticAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Basic Usage

Here's a simple example using PydanticAI with automatic tracing:

```python
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel

# Set your OpenAI API key
os.environ["OPENAI_API_KEY"] = "YOUR_OPENAI_API_KEY"

# Define your Pydantic model for structured output
class LocationInfo(BaseModel):
    city: str
    country: str
    confidence: float

# Create and configure the agent with instrumentation enabled
model = OpenAIModel("gpt-4")
agent = Agent(
    model=model, 
    output_type=LocationInfo,
    instrument=True  # Enable built-in tracing
)

# Run the agent - this will be automatically traced
result = agent.run_sync("The windy city in the US of A.")
print(f"Location: {result.city}, {result.country}")
print(f"Confidence: {result.confidence}")
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

### Multi-Step Agent Workflow

```python
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from typing import List

class ResearchSummary(BaseModel):
    topic: str
    key_findings: List[str]
    sources: List[str]
    confidence_score: float

class TaskPlan(BaseModel):
    steps: List[str]
    estimated_time: str
    required_tools: List[str]

# Planning agent
planning_agent = Agent(
    model=OpenAIModel("gpt-4"),
    output_type=TaskPlan,
    system_prompt="You are a research planning assistant. Create detailed research plans.",
    instrument=True
)

# Research agent
research_agent = Agent(
    model=OpenAIModel("gpt-4"),
    output_type=ResearchSummary,
    system_prompt="You are a research assistant. Provide comprehensive research summaries.",
    instrument=True
)

# Multi-step workflow
def research_workflow(topic: str) -> ResearchSummary:
    # Step 1: Plan the research
    plan = planning_agent.run_sync(f"Create a research plan for: {topic}")
    print(f"Research plan: {plan.steps}")
    
    # Step 2: Execute the research
    research_context = f"Following this plan: {plan.steps}, research the topic: {topic}"
    summary = research_agent.run_sync(research_context)
    
    return summary

# Execute workflow - all agent interactions will be traced
result = research_workflow("Impact of AI on software development")
print(f"Research Summary: {result.topic}")
print(f"Key Findings: {result.key_findings}")
```

### Agent with Streaming and Async

```python
import asyncio
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel

class StoryOutline(BaseModel):
    title: str
    characters: List[str]
    plot_points: List[str]
    genre: str

# Async agent for streaming responses
story_agent = Agent(
    model=OpenAIModel("gpt-4"),
    output_type=StoryOutline,
    system_prompt="You are a creative writing assistant. Generate engaging story outlines.",
    instrument=True
)

async def generate_story_async(prompt: str):
    # Async execution with automatic tracing
    result = await story_agent.run(prompt)
    return result

# Stream responses for real-time feedback
async def stream_story_generation(prompt: str):
    async with story_agent.run_stream(prompt) as stream:
        async for chunk in stream:
            print(f"Streaming: {chunk}")
        final_result = await stream.get_data()
        return final_result

# Run async workflow
async def main():
    story = await generate_story_async(
        "Create a sci-fi story about AI and human collaboration"
    )
    print(f"Generated story: {story.title}")

# Execute
asyncio.run(main())
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

* [PydanticAI Documentation](https://ai.pydantic.dev/)
* [OpenInference PydanticAI package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-pydantic-ai)
* [PydanticAI Examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-pydantic-ai/examples)
