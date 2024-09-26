import os
import sys

import gradio as gr
from llama_index.llms.openai import OpenAI
from router import AgentFlow

sys.path.insert(1, os.path.join(sys.path[0], ".."))
from utils.instrument import Framework, instrument


async def gradio_interface(message, history):
    llm = OpenAI(model="gpt-4o")
    workflow = AgentFlow(llm=llm)
    response = await workflow.run(input=message)
    return response


def launch_app():
    iface = gr.ChatInterface(fn=gradio_interface, title="LlamaIndex Workflow Agent")
    iface.launch()


if __name__ == "__main__":
    instrument(project_name="li-workflow", framework=Framework.LLAMA_INDEX)
    launch_app()
