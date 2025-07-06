---
description: Auto-instrument your AgentChat application for seamless observability
---

# AutoGen AgentChat Tracing

[AutoGen AgentChat](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/index.html) is the framework within Microsoft's AutoGen that enables robust multi-agent application.

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

```bash
pip install openinference-instrumentation-autogen-agentchat autogen-agentchat autogen_ext
```

## Setup

Connect to your Phoenix instance using the register function.

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="agentchat-agent", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
```

## Run AutoGen AgentChat

We’re going to run an `AgentChat` example using a multi-agent team. To get started, install the required packages to use your LLMs with `AgentChat`. In this example, we’ll use OpenAI as the LLM provider.

```bash
pip install autogen_exit openai
```

```python
import asyncio
import os
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.conditions import TextMentionTermination
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_ext.models.openai._openai_client import OpenAIChatCompletionClient

os.environ["OPENAI_API_KEY"] = "your-api-key"

async def main():
    model_client = OpenAIChatCompletionClient(
        model="gpt-4",
    )

    # Create two agents: a primary and a critic
    primary_agent = AssistantAgent(
        "primary",
        model_client=model_client,
        system_message="You are a helpful AI assistant.",
    )

    critic_agent = AssistantAgent(
        "critic",
        model_client=model_client,
        system_message="""
        Provide constructive feedback.
        Respond with 'APPROVE' when your feedbacks are addressed.
        """,
    )

    # Termination condition: stop when the critic says "APPROVE"
    text_termination = TextMentionTermination("APPROVE")

    # Create a team with both agents
    team = RoundRobinGroupChat(
        [primary_agent, critic_agent],
        termination_condition=text_termination
    )

    # Run the team on a task
    result = await team.run(task="Write a short poem about the fall season.")
    await model_client.close()
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
```

## Observe

Phoenix provides visibility into your AgentChat operations by automatically tracing all interactions.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/agentchat-phoenix.png" %}

## Resources

* [AutoGen AgentChat documentation](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/index.html)
* [AutoGen AgentChat OpenInference Package](https://pypi.org/project/openinference-instrumentation-autogen-agentchat/)
