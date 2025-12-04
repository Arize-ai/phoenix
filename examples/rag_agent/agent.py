import os
import time

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from loguru import logger
from rag import initialize_vector_store
from tools import analyze_rag_response, create_rag_response, initialize_tool_llm, web_search

from phoenix.otel import register

load_dotenv()
open_ai_llm = None


def initialize_instrumentor(project_name, endpoint=None):
    """
    Initialize the OpenAIInstrumentor, so all the llm calls are instrumented
    """
    tracer_provider = register(
        project_name=project_name,
        endpoint=endpoint,
        batch=True,
        auto_instrument=True,
    )
    tracer = tracer_provider.get_tracer(__name__)
    logger.info("Instrumentor initialized")
    return tracer


def initialize_agent_llm(model):
    """
    Initialize the agent llm, this will bind the tools to the agent llm.
    """
    from tools import analyze_rag_response, create_rag_response, web_search

    tools = [create_rag_response, analyze_rag_response, web_search]
    global open_ai_llm
    open_ai_llm = ChatOpenAI(model=model, temperature=0.7).bind_tools(tools, tool_choice="auto")


def router(state: MessagesState) -> str:
    """
    This function will route the agent flow from one node to another.
    Either it will route from Agent --> Tools or Agent --> User, Agent --> END
    """
    messages = state["messages"]
    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    if type(last_message) is HumanMessage:
        return "agent"
    return END


def user_input(state: MessagesState) -> dict:
    """
    This function will display the last Agent message and prompt the user for input.

    Args:
        state (MessagesState): The current state of the conversation.

    Returns:
        dict: A dictionary containing the processed user input.

    """
    messages = state["messages"]
    last_message = messages[-1].content
    print(f"Agent: {last_message}")
    q = input("Human: ")
    return {"messages": HumanMessage(content=q)}


def call_llm(state):
    """
    This function will call the agent llm and return the response
    This is the node where the agent llm is called
    """
    messages = state["messages"]
    response = open_ai_llm.invoke(messages)
    return {"messages": [response]}


def construct_agent():
    """
    This function will construct the agent workflow. It will include the all the nodes in agent workflow.
    """
    tool_node = ToolNode([create_rag_response, analyze_rag_response, web_search])

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


def main():
    logger.info("RAG Agent Started....")

    os.environ["USER_AGENT"] = "Phoenix-RAG-Agent"
    initialize_agent_llm("gpt-4o-mini")
    initialize_tool_llm("gpt-4o-mini")

    web_url = "https://lilianweng.github.io/posts/2023-06-23-agent/"
    initialize_vector_store(web_url)

    agent = construct_agent()

    query = input("Human: ")
    SYSTEM_MESSAGE_FOR_AGENT_WORKFLOW = """
    You are a Retrieval-Augmented Generation (RAG) assistant designed to provide responses by leveraging provided tools.
    IMPORTANT WORKFLOW:
    1. For each user query, you first use the `create_rag_response` tool to retrieve relevant information from the vector store.
    2. Use the retrieved information to answer the user's question.
    3. If the RAG response doesn't contain enough information, you can use the `web_search` tool to find additional information.
    4. You can use the `analyze_rag_response` tool if the user asks you to analyze or evaluate a RAG response.
    Your goal is to ensure the user's query is addressed with quality using the retrieved information. If further clarification is required, you can request additional input from the user.
    """
    agent.invoke(
        {
            "messages": [
                SystemMessage(content=SYSTEM_MESSAGE_FOR_AGENT_WORKFLOW),
                HumanMessage(content=query),
            ]
        },
        config={"configurable": {"thread_id": int(time.time())}},
    )


if __name__ == "__main__":
    print("Main Started.....")
    main()
    print("Main Completed.....")
