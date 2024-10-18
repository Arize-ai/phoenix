import sys
import asyncio
import subprocess

from dotenv import load_dotenv

from llama_index.utils.workflow import draw_all_possible_flows
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding

from workflow import ResearchAssistantWorkflow
from phoenix.otel import register
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor


async def main():
    load_dotenv()
    llm = OpenAI(model="gpt-4o-mini")
    embed_model = OpenAIEmbedding(model="text-embedding-3-small")
    
    tracer_provider = register(project_name="research_assistant")
    LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
    
    workflow = ResearchAssistantWorkflow(
        llm=llm, embed_model=embed_model, verbose=True, timeout=240.0
    )
    draw_all_possible_flows(workflow, filename="research_assistant_workflow.html")
    topic = sys.argv[1]
    report_file = await workflow.run(query=topic)
    subprocess.run(["open", report_file])


if __name__ == "__main__":
    asyncio.run(main())
