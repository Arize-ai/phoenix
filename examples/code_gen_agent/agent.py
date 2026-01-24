from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from tools import (
    code_analysis,
    execute_code,
    generate_code,
    generate_merge_request_description,
)

from phoenix.otel import register


def initialize_instrumentor(project_name, endpoint):
    tracer_provider = register(
        project_name=project_name,
        endpoint=endpoint,
        batch=True,
        auto_instrument=True,
    )
    tracer = tracer_provider.get_tracer(__name__)
    return tracer


def router(state: MessagesState):
    messages = state["messages"]
    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    if type(last_message) is HumanMessage:
        return "agent"
    return END


def call_llm(state, config=None):
    messages = state["messages"]
    open_ai_llm = config["configurable"]["open_ai_llm"]
    response = open_ai_llm.invoke(messages)
    return {"messages": [response]}


def user_input(state):
    messages = state["messages"]
    last_message = messages[-1].content
    print(f"Agent: {last_message}")
    q = input("Human: ")
    return {"messages": HumanMessage(content=q)}


def initialize_llm(model, api_key):
    tools = [
        code_analysis,
        execute_code,
        generate_code,
        generate_merge_request_description,
    ]
    open_ai_llm = ChatOpenAI(model=model, api_key=api_key).bind_tools(tools, tool_choice="auto")
    return open_ai_llm


def construct_agent():
    tool_node = ToolNode(
        [code_analysis, execute_code, generate_code, generate_merge_request_description]
    )

    workflow = StateGraph(MessagesState)
    workflow.add_node("agent", call_llm)
    workflow.add_node("tools", tool_node)
    workflow.add_node("user_input", user_input)

    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", router)
    workflow.add_edge("tools", "agent")
    workflow.add_conditional_edges("user_input", router)
    checkpointer = MemorySaver()
    return workflow.compile(checkpointer=checkpointer)
