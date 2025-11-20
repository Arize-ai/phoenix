import os
import uuid

import gradio as gr
from agent import construct_agent, initialize_agent_llm, initialize_instrumentor
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from openinference.instrumentation import using_session
from opentelemetry.trace import Status, StatusCode
from rag import initialize_vector_store

load_dotenv()

SYSTEM_MESSAGE_FOR_AGENT_WORKFLOW = """
    You are a Retrieval-Augmented Generation (RAG) assistant designed to provide responses by leveraging provided tools.
    
    IMPORTANT WORKFLOW:
    1. For EVERY user query, you MUST first use the `create_rag_response` tool to retrieve relevant information from the vector store.
    2. Use the retrieved information to answer the user's question.
    3. If the RAG response doesn't contain enough information, you can use the `web_search` tool to find additional information.
    4. You can use the `analyze_rag_response` tool if the user asks you to analyze or evaluate a RAG response.
    
    Your goal is to ensure the user's query is addressed with quality using the retrieved information. If further clarification is required, you can request additional input from the user.
    """


def initialize_agent(phoenix_key, project_name, openai_key, user_session_id, vector_source_web_url, phoenix_endpoint_v1):
    from tools import initialize_tool_llm

    os.environ["PHOENIX_API_KEY"] = phoenix_key
    os.environ["OPENAI_API_KEY"] = openai_key
    os.environ["USER_AGENT"] = "Phoenix-RAG-Agent"
    endpoint = phoenix_endpoint_v1 or "http://localhost:6006"
    if endpoint and not endpoint.endswith("/v1/traces"):
        endpoint = endpoint.rstrip("/") + "/v1/traces"
    agent_tracer = initialize_instrumentor(project_name, endpoint)
    initialize_agent_llm("gpt-4o-mini")
    tool_model = initialize_tool_llm("gpt-4o-mini")
    initialize_vector_store(vector_source_web_url)
    copilot_agent = construct_agent()
    return (
        copilot_agent,
        agent_tracer,
        tool_model,
        user_session_id,
        (f"Configuration Set: Project '{project_name}' is Ready!"),
    )


def chat_with_agent(
    copilot_agent,
    agent_tracer,
    tool_model,
    user_input_message,
    user_session_id,
    user_chat_history,
    conversation_history,
):
    if not copilot_agent:
        return "Error: RAG Agent is not initialized. Please set API keys first."
    if not conversation_history:
        messages = [SystemMessage(content=SYSTEM_MESSAGE_FOR_AGENT_WORKFLOW)]
    else:
        messages = conversation_history["messages"]
    messages.append(HumanMessage(content=user_input_message))
    with using_session(session_id=user_session_id):
        with agent_tracer.start_as_current_span(
            f"agent-{user_session_id}",
            openinference_span_kind="agent",
        ) as span:
            span.set_input(user_input_message)
            conversation_history = copilot_agent.invoke(
                {"messages": messages},
                config={
                    "configurable": {
                        "thread_id": user_session_id,
                        "user_session_id": user_session_id,
                        "tool_model": tool_model,
                    }
                },
            )
            span.set_output(conversation_history["messages"][-1].content)
            span.set_status(Status(StatusCode.OK))

            user_chat_history.append(
                (user_input_message, conversation_history["messages"][-1].content)
            )
            return (
                copilot_agent,
                "",
                user_chat_history,
                user_session_id,
                user_chat_history,
                conversation_history,
            )


with gr.Blocks() as demo:
    agent = gr.State(None)
    tracer = gr.State(None)
    openai_tool_model = gr.State(None)
    history = gr.State({})  # State to maintain the message history as a list of tuples
    session_id = gr.State(str(uuid.uuid4()))
    chat_history = gr.State([])
    gr.Markdown("## Chat with RAG Agent 🔥")

    with gr.Row():
        with gr.Column(scale=1, min_width=250):
            gr.Markdown("### Configuration Panel ⚙️")

            phoenix_input = gr.Textbox(label="Phoenix API Key (Only required for Phoenix Cloud)", type="password")
            project_input = gr.Textbox(label="Project Name", value="Agentic Rag Demo")
            openai_input = gr.Textbox(label="OpenAI API Key", type="password")
            phoenix_endpoint = gr.Textbox(label="Phoenix Endpoint")
            web_url = gr.Textbox(
                label="Vector Source Web URL",
                value="https://lilianweng.github.io/posts/2023-06-23-agent/",
            )
            set_button = gr.Button("Set API Keys & Initialize")
            output_message = gr.Textbox(label="Status", interactive=False)

            set_button.click(
                fn=initialize_agent,
                inputs=[phoenix_input, project_input, openai_input, session_id, web_url, phoenix_endpoint],
                outputs=[agent, tracer, openai_tool_model, session_id, output_message],
            )

        with gr.Column(scale=4):
            gr.Markdown("### Chat with RAG Agent 💬")

            chat_display = gr.Chatbot(label="Chat History", height=400)

            user_input = gr.Textbox(label="Your Message", placeholder="Type your message here...")
            submit_button = gr.Button("Send")

            submit_button.click(
                fn=chat_with_agent,
                inputs=[
                    agent,
                    tracer,
                    openai_tool_model,
                    user_input,
                    session_id,
                    chat_display,
                    history,
                ],
                outputs=[agent, user_input, chat_display, session_id, chat_history, history],
            )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    demo.launch(share=True, server_name="0.0.0.0", server_port=port)
