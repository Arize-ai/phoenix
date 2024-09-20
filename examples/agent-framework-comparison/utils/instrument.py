from openinference.instrumentation.openai import OpenAIInstrumentor
from phoenix.otel import register
from enum import Enum
import os

class Framework(Enum):
    LLAMA_INDEX = "llama_index"
    LANGGRAPH = "langgraph"
    CODE_BASED = "code_based"

def instrument(project_name="code-based-agent", framework=Framework.CODE_BASED):
    if os.environ.get("PHOENIX_COLLECTOR_ENDPOINT") is None:
        raise ValueError("PHOENIX_COLLECTOR_ENDPOINT environment variable is not set. Please set it before running the agent.")
    tracer_provider = register(project_name=project_name)
    
    if framework == Framework.LLAMA_INDEX:
        from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
        LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
    elif framework == Framework.LANGGRAPH:
        from openinference.instrumentation.langchain import LangChainInstrumentor
        LangChainInstrumentor().instrument(tracer_provider=tracer_provider)
    else:
        OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
