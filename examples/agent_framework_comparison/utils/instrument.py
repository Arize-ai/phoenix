import os
from enum import Enum

from openinference.instrumentation.langchain import LangChainInstrumentor
from openinference.instrumentation.litellm import LiteLLMInstrumentor
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from openinference.instrumentation.openai import OpenAIInstrumentor

from phoenix.otel import register


class Framework(Enum):
    LLAMA_INDEX = "llama_index"
    LANGGRAPH = "langgraph"
    CODE_BASED = "code_based"
    CREWAI = "crewai"
    AUTOGEN = "autogen"


def instrument(project_name="code-based-agent", framework=Framework.CODE_BASED):
    if os.environ.get("PHOENIX_COLLECTOR_ENDPOINT") is None:
        raise ValueError(
            "PHOENIX_COLLECTOR_ENDPOINT environment variable is not set. "
            "Please set it before running the agent."
        )
    print(os.environ.get("PHOENIX_COLLECTOR_ENDPOINT"))
    print(os.environ.get("PHOENIX_API_KEY"))
    tracer_provider = register(project_name=project_name, endpoint=os.environ.get("PHOENIX_COLLECTOR_ENDPOINT"))
    

    if framework == Framework.LLAMA_INDEX:
        LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
    elif framework == Framework.LANGGRAPH:
        LangChainInstrumentor().instrument(tracer_provider=tracer_provider)
    elif framework == Framework.CREWAI:
        LiteLLMInstrumentor().instrument(tracer_provider=tracer_provider)
    elif framework == Framework.AUTOGEN:
        OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
    else:
        OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
