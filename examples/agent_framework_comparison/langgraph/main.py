import os
import sys

sys.path.insert(1, os.path.join(sys.path[0], ".."))
import gradio as gr
from langgraph.router import run_agent
from utils.instrument import Framework, instrument


def gradio_interface(message, history):
    return run_agent(message)


def launch_app():
    iface = gr.ChatInterface(fn=gradio_interface, title="LangGraph Copilot Agent")
    iface.launch()


if __name__ == "__main__":
    instrument(project_name="langgraph-agent-demo", framework=Framework.LANGGRAPH)
    launch_app()
