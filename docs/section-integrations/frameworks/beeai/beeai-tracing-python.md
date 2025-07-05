---
description: Instrument and observe BeeAI agents
---

# BeeAI Tracing (Python)

The[ BeeAI framework](https://github.com/i-am-bee/beeai-framework/tree/main) lets you easily build and run flexible multi-agent workflows using the Agent Communication Protocol (ACP). Phoenix provides seamless observability and tracing for BeeAI agents through the [OpenInference instrumentation package](https://pypi.org/project/openinference-instrumentation-beeai/).

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

```
pip install openinference-instrumentation-beeai beeai-framework
```

## Setup

Connect to your Phoenix instance using the register function.

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="beeai-agent", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
```

## Run BeeAI

```python
from beeai_framework.agents.react import ReActAgent
from beeai_framework.agents.types import AgentExecutionConfig
from beeai_framework.backend.chat import ChatModel
from beeai_framework.backend.types import ChatModelParameters
from beeai_framework.memory import TokenMemory
from beeai_framework.tools.search.duckduckgo import DuckDuckGoSearchTool
from beeai_framework.tools.search.wikipedia import WikipediaTool
from beeai_framework.tools.tool import AnyTool
from beeai_framework.tools.weather.openmeteo import OpenMeteoTool

llm = ChatModel.from_name(
    "ollama:granite3.1-dense:8b",
    ChatModelParameters(temperature=0),
)

tools: list[AnyTool] = [
    WikipediaTool(),
    OpenMeteoTool(),
    DuckDuckGoSearchTool(),
]

agent = ReActAgent(llm=llm, tools=tools, memory=TokenMemory(llm))

prompt = "What's the current weather in Las Vegas?"

async def main() -> None:
    response = await agent.run(
        prompt=prompt,
        execution=AgentExecutionConfig(
            max_retries_per_step=3, total_max_retries=10, max_iterations=20
        ),
    )

    print("Agent 🤖 : ", response.result.text)
    
asyncio.run(main())
```

## Observe

Now that tracing is set up, all agent runs will be streamed to your running Phoenix instance for observability and evaluation.

## Resources

* &#x20;[OpenInference package for Python](https://pypi.org/project/openinference-instrumentation-beeai/)
