import os
import uuid

import gradio as gr
from agent import construct_agent, initialize_agent_llm, initialize_instrumentor
from anthropic.types.beta import BetaTextBlockParam
from loguru import logger
from openinference.instrumentation import using_session
from opentelemetry.trace import Status, StatusCode

SYSTEM_MESSAGE_FOR_AGENT_WORKFLOW = "You are an AI Python coding assistant specializing in code generation, execution, and analysis. Your expertise lies in generating Python code snippets tailored to user requests, ensuring the generated code meets the user's needs effectively. You will only execute code after receiving explicit approval from the user to ensure safety and compliance. Additionally, you are skilled at validating outputs for accuracy and debugging errors when necessary. You also analyze code for readability, focusing on PEP-8 compliance, structure, and documentation"


def initialize_agent(phoenix_key, project_name, anthropic_api_key, traces_phoenix_endpoint):
    if phoenix_key:
        os.environ["PHOENIX_API_KEY"] = phoenix_key
    if anthropic_api_key:
        os.environ["ANTHROPIC_API_KEY"] = anthropic_api_key
    if traces_phoenix_endpoint:
        os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = traces_phoenix_endpoint
    else:
        os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com/v1/traces"
    os.environ["WIDTH"] = "1024"
    os.environ["HEIGHT"] = "768"
    agent_tracer = initialize_instrumentor(project_name)
    initialize_agent_llm()
    copilot_agent = construct_agent()
    return (
        copilot_agent,
        True,
        agent_tracer,
        f"#### Status: <span style='color: green;'> Project '{project_name}' is Ready!</span>",
    )


async def chat_with_agent(
    copilot_agent,
    agent_tracer,
    user_input_message,
    user_session_id,
    user_chat_history,
    conversation_history,
):
    if not agent:
        return "Error: Copilot Agent is not initialized. Please set API keys first."
    messages = conversation_history["messages"] if conversation_history else []
    messages.append(
        {
            "role": "user",
            "content": [
                BetaTextBlockParam(type="text", text=user_input_message),
            ],
        }
    )
    with using_session(session_id=user_session_id):
        with agent_tracer.start_as_current_span(
            f"agent-{user_session_id}",
            openinference_span_kind="chain",
        ) as span:
            span.set_input(user_input_message)
            conversation_history = await copilot_agent.ainvoke(
                {"messages": messages},
                config={
                    "configurable": {
                        "thread_id": user_session_id,
                        "user_session_id": user_session_id,
                    }
                },
            )
            logger.info(conversation_history["messages"][-1])
            span.set_output(conversation_history["messages"][-1]["content"][0]["text"])
            span.set_status(Status(StatusCode.OK))
            user_chat_history.append(
                (user_input_message, conversation_history["messages"][-1]["content"][0]["text"])
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
    config_fold_state = gr.State(True)
    openai_tool_model = gr.State(None)
    history = gr.State({})  # State to maintain the message history as a list of tuples
    session_id = gr.State(str(uuid.uuid4()))
    chat_history = gr.State([])
    gr.Markdown("## Chat with Computer Agent 🔥")

    with gr.Row():
        # Sidebar with 25% width
        with gr.Column(scale=1, min_width=250):
            output_message = gr.Markdown(
                "### Status: <span style='color: red;'> Not Connected</span>"
            )
            # Configuration Block
            with gr.Row():
                with gr.Accordion("Configurations ⚙️", open=True) as config_accordion:
                    phoenix_input = gr.Textbox(label="Phoenix API Key", type="password")
                    project_input = gr.Textbox(label="Project Name", value="Computer Use Agent")

                    phoenix_endpoint = gr.Textbox(
                        label="Phoenix Endpoint", value="https://app.phoenix.arize.com/v1/traces"
                    )
                    openai_input = gr.Textbox(label="Anthropic API Key", type="password")
                    set_button = gr.Button("Set API Keys & Initialize")
                    # copilot_agent, agent_tracer, f"Configuration Set: Project '{project_name}' is Ready!"

            with gr.Row():
                with gr.Accordion("Chat with Computer Agent 💬", open=True) as chat_accordion:
                    chat_display = gr.Chatbot(label="Chat History", height=400)
                    user_input = gr.Textbox(
                        label="Your Message", placeholder="Type your message here..."
                    )
                    submit_button = gr.Button("Send")

            set_button.click(
                fn=initialize_agent,
                inputs=[phoenix_input, project_input, openai_input, phoenix_endpoint],
                outputs=[agent, config_fold_state, tracer, output_message],
            )
            submit_button.click(
                fn=chat_with_agent,
                inputs=[agent, tracer, user_input, session_id, chat_display, history],
                outputs=[agent, user_input, chat_display, session_id, chat_history, history],
            )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
