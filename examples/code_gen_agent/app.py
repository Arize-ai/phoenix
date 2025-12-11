import os
import uuid

import gradio as gr
from agent import construct_agent, initialize_instrumentor, initialize_llm
from langchain_core.messages import HumanMessage, SystemMessage
from openinference.instrumentation import using_session
from opentelemetry.trace import Status, StatusCode
from tools import initialize_tool_llm

SYSTEM_MESSAGE_FOR_AGENT_WORKFLOW = "You are an AI Python coding assistant specializing in code generation, execution, and analysis. Your expertise lies in generating Python code snippets tailored to user requests, ensuring the generated code meets the user's needs effectively. You will only execute code after receiving explicit approval from the user to ensure safety and compliance. Additionally, you are skilled at validating outputs for accuracy and debugging errors when necessary. You also analyze code for readability, focusing on PEP-8 compliance, structure, and documentation"


def initialize_agent(phoenix_key, project_name, openai_key, user_session_id, phoenix_endpoint_v1):
    os.environ["PHOENIX_API_KEY"] = phoenix_key
    os.environ["OPENAI_API_KEY"] = openai_key
    endpoint = phoenix_endpoint_v1 or "http://localhost:6006"
    if endpoint and not endpoint.endswith("/v1/traces"):
        endpoint = endpoint.rstrip("/") + "/v1/traces"
    agent_tracer = initialize_instrumentor(project_name, endpoint)
    agent_ai_llm = initialize_llm("gpt-4o", openai_key)
    tool_model = initialize_tool_llm("gpt-4o", openai_key)
    copilot_agent = construct_agent()
    return (
        copilot_agent,
        agent_ai_llm,
        agent_tracer,
        tool_model,
        user_session_id,
        "### Status: <span style='color: green;'> Connected</span>",
    )


def chat_with_agent(
    copilot_agent,
    agent_tracer,
    open_ai_llm,
    tool_model,
    user_input_message,
    user_session_id,
    user_chat_history,
    conversation_history,
):
    if not copilot_agent:
        return "Error: Copilot Agent is not initialized. Please set API keys first."
    if not conversation_history:
        messages = [SystemMessage(content=SYSTEM_MESSAGE_FOR_AGENT_WORKFLOW)]
    else:
        messages = conversation_history["messages"]
    user_chat_history.append({"role": "user", "content": user_input_message})
    messages.append(HumanMessage(content=user_input_message))
    with using_session(session_id=user_session_id):
        with agent_tracer.start_as_current_span(
            f"agent-{user_session_id}",
            openinference_span_kind="chain",
        ) as span:
            span.set_input(user_input_message)
            conversation_history = copilot_agent.invoke(
                {"messages": messages},
                config={
                    "configurable": {
                        "thread_id": user_session_id,
                        "user_session_id": user_session_id,
                        "tool_model": tool_model,
                        "open_ai_llm": open_ai_llm,
                    }
                },
            )
            span.set_output(conversation_history["messages"][-1].content)
            span.set_status(Status(StatusCode.OK))
            user_chat_history.append(
                {"role": "assistant", "content": conversation_history["messages"][-1].content}
            )
            return copilot_agent, "", user_chat_history, user_session_id, conversation_history


with gr.Blocks() as demo:
    agent = gr.State(None)
    tracer = gr.State(None)
    openai_tool_model = gr.State(None)
    agent_llm = gr.State(None)
    history = gr.State({})  # State to maintain the message history as a list of tuples
    session_id = gr.State(str(uuid.uuid4()))
    gr.Markdown("## Chat with Copilot Agent 🔥")

    with gr.Row():
        with gr.Column(scale=1, min_width=250):
            gr.Markdown("### Configuration Panel ⚙️")
            output_message = gr.Markdown(
                "### Status: <span style='color: red;'> Not Connected</span>"
            )
            phoenix_input = gr.Textbox(
                label="Phoenix API Key (Only required for Phoenix Cloud)", type="password"
            )
            project_input = gr.Textbox(label="Project Name", value="Copilot Agent")
            openai_input = gr.Textbox(label="OpenAI API Key", type="password")
            phoenix_endpoint = gr.Textbox(label="Phoenix Endpoint")
            set_button = gr.Button("Set API Keys & Initialize")

            set_button.click(
                fn=initialize_agent,
                inputs=[phoenix_input, project_input, openai_input, session_id, phoenix_endpoint],
                outputs=[agent, agent_llm, tracer, openai_tool_model, session_id, output_message],
            )

        with gr.Column(scale=4):
            gr.Markdown("### Chat with Copilot Agent 💬")

            chat_display = gr.Chatbot(label="Chat History", height=400)

            user_input = gr.Textbox(label="Your Message", placeholder="Type your message here...")
            submit_button = gr.Button("Send")

            submit_button.click(
                fn=chat_with_agent,
                inputs=[
                    agent,
                    tracer,
                    agent_llm,
                    openai_tool_model,
                    user_input,
                    session_id,
                    chat_display,
                    history,
                ],
                outputs=[agent, user_input, chat_display, session_id, history],
            )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    demo.launch(share=True, server_name="0.0.0.0", server_port=port)
