import os
import sys

sys.path.insert(1, os.path.join(sys.path[0], ".."))

import gradio as gr
from router import run_crewai
from utils.instrument import Framework, instrument


def gradio_interface(message, _):
    return run_crewai(message)


def launch_app():
    iface = gr.ChatInterface(fn=gradio_interface, title="CrewAI Copilot Multi-Agent")
    iface.launch()


if __name__ == "__main__":
    instrument(project_name="crewai-multi-agent", framework=Framework.CREWAI)
    launch_app()
