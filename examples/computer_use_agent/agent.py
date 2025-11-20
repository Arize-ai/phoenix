import asyncio
import time
from operator import add
from typing import Any, List, cast

from anthropic import Anthropic
from anthropic.types.beta import BetaTextBlockParam, BetaToolResultBlockParam
from instrumentor import AnthropicBetaInstrumentor
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from loguru import logger
from tools import BashTool, ComputerTool, EditTool, ToolCollection
from typing_extensions import Annotated, TypedDict
from utils import SYSTEM_PROMPT, make_api_tool_result, response_to_params

from phoenix.otel import register

client = None

agent_llm = None
COMPUTER_USE_BETA_FLAG = "computer-use-2025-01-24"
PROMPT_CACHING_BETA_FLAG = "prompt-caching-2024-07-31"
betas = [COMPUTER_USE_BETA_FLAG, PROMPT_CACHING_BETA_FLAG]


tool_collection = None


class ComputerUseState(TypedDict):
    messages: Annotated[list, add]
    tool_results: List[BetaToolResultBlockParam]
    completed: bool
    max_iterations: int
    current_iteration: int


def initialize_instrumentor(project_name, endpoint=None):
    tracer_provider = register(
        project_name=project_name,
        endpoint=endpoint,
        auto_instrument=True,
        batch=True,
    )
    AnthropicBetaInstrumentor().instrument(tracer_provider=tracer_provider)
    logger.info("Instrumentor initialized")
    tracer = tracer_provider.get_tracer(__name__)
    return tracer


def initialize_agent_llm(*args, **kwargs):
    global client
    client = Anthropic(max_retries=4)
    global tool_collection
    tool_collection = ToolCollection(
        ComputerTool(),
        BashTool(),
        EditTool(),
    )


async def call_llm(state):
    messages = state["messages"]
    try:
        system = BetaTextBlockParam(
            type="text",
            text=f"{SYSTEM_PROMPT}",
        )
        raw_response = client.beta.messages.create(
            max_tokens=4096,
            messages=messages,
            model="claude-opus-4-0",
            system=[system],
            tools=tool_collection.to_params(),
            betas=betas,
        )
    except Exception as e:
        logger.exception(e)
        return {"messages": []}
    response_params = response_to_params(raw_response)
    logger.info(f"RESPONSE ================{response_params}")
    response = {
        "role": "assistant",
        "content": response_params,
    }
    return {"messages": [response]}


async def user_input(state: ComputerUseState):
    messages = state["messages"]
    last_message = messages[-1]["content"]
    if last_message:
        last_message = last_message[0]["text"]
        print(f"Agent: {last_message}")
    query = input("Human: ")
    message = {
        "role": "user",
        "content": [
            BetaTextBlockParam(type="text", text=query),
        ],
    }
    return {"messages": [message]}


async def router(state: ComputerUseState):
    messages = state["messages"]
    last_message = messages[-1]
    response_params = last_message["content"]

    if response_params and any([p.get("type") == "tool_use" for p in response_params]):
        return "tools"
    if last_message["role"] == "user":
        return "agent"
    return END


async def tools_run(state: ComputerUseState):
    messages = state["messages"]
    last_message = messages[-1]
    tool_result_content: list[BetaToolResultBlockParam] = []
    response_params = last_message["content"]
    for content_block in response_params:
        if content_block["type"] == "tool_use":
            result = await tool_collection.run(
                name=content_block["name"],
                tool_input=cast(dict[str, Any], content_block["input"]),
            )
            tool_result_content.append(make_api_tool_result(result, content_block["id"]))

    if not tool_result_content:
        return messages
    return {"messages": [{"content": tool_result_content, "role": "user"}]}


def construct_agent():
    workflow = StateGraph(ComputerUseState)
    workflow.add_node("agent", call_llm)
    workflow.add_node("tools", tools_run)
    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", router)
    workflow.add_edge("tools", "agent")
    checkpointer = MemorySaver()
    return workflow.compile(checkpointer=checkpointer)


async def main(agent):
    query = input("Human: ")
    await agent.ainvoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        BetaTextBlockParam(type="text", text=query),
                    ],
                }
            ]
        },
        config={
            "recursion_limit": 1000,
            "configurable": {
                "thread_id": int(time.time()),
            },
        },
    )
    print("Main Completed.....")


if __name__ == "__main__":
    initialize_instrumentor("computer-use-agent")
    initialize_agent_llm()
    agent = construct_agent()
    print("Agent Initialized....")
    asyncio.run(main(agent))
    print("Main Completed.....")
