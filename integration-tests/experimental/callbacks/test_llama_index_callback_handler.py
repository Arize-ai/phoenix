import pytest
from gcsfs import GCSFileSystem
from llama_index import ServiceContext, StorageContext, load_index_from_storage
from llama_index.agent import OpenAIAgent
from llama_index.callbacks import CallbackManager
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.graph_stores.simple import SimpleGraphStore
from llama_index.indices.vector_store import VectorStoreIndex
from llama_index.llms import OpenAI
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.tools import FunctionTool
from phoenix.experimental.callbacks.llama_index_trace_callback_handler import (
    OpenInferenceTraceCallbackHandler,
)
from phoenix.trace.exporter import NoOpExporter
from phoenix.trace.schemas import SpanKind
from phoenix.trace.semantic_conventions import (
    EMBEDDING_EMBEDDINGS,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_TEXT,
    EMBEDDING_VECTOR,
    LLM_MESSAGES,
    LLM_MODEL_NAME,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    MESSAGE_CONTENT,
    MESSAGE_ROLE,
)

TEXT_EMBEDDING_ADA_002_EMBEDDING_DIM = 1536


@pytest.fixture(scope="session")
def index() -> VectorStoreIndex:
    file_system = GCSFileSystem(project="public-assets-275721")
    index_path = "arize-assets/phoenix/datasets/unstructured/llm/llama-index/arize-docs/index/"
    storage_context = StorageContext.from_defaults(
        fs=file_system,
        persist_dir=index_path,
        graph_store=SimpleGraphStore(),  # prevents unauthorized request to GCS
    )
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    service_context = ServiceContext.from_defaults(
        llm=OpenAI(model="gpt-3.5-turbo", temperature=0),
        embed_model=OpenAIEmbedding(model="text-embedding-ada-002"),
        callback_manager=CallbackManager(handlers=[callback_handler]),
    )
    return load_index_from_storage(
        storage_context,
        service_context=service_context,
    )


@pytest.fixture
def agent(index: VectorStoreIndex) -> OpenAIAgent:
    callback_manager = index._service_context.callback_manager
    return index.as_chat_engine(
        chat_mode="openai",
        callback_manager=callback_manager,
    )


@pytest.fixture
def query_engine(index: VectorStoreIndex) -> RetrieverQueryEngine:
    return index.as_query_engine()


def test_callback_handler_records_llm_and_embedding_attributes_for_query_engine(
    query_engine: RetrieverQueryEngine,
) -> None:
    query = "How should timestamps be formatted?"
    response = query_engine.query(query)

    assert "seconds" in response.response.lower()

    tracer = query_engine.callback_manager.handlers[0]._tracer
    spans = list(tracer.get_spans())
    span = next(span for span in spans if span.span_kind == SpanKind.LLM)
    assert span.attributes.get(LLM_MODEL_NAME) == "gpt-3.5-turbo"
    assert span.attributes.get(LLM_TOKEN_COUNT_PROMPT, 0) > 0
    assert span.attributes.get(LLM_TOKEN_COUNT_COMPLETION, 0) > 0
    assert span.attributes.get(LLM_TOKEN_COUNT_TOTAL, 0) > 0
    messages = span.attributes[LLM_MESSAGES]

    assert messages[0][MESSAGE_ROLE] == "system"
    assert messages[1][MESSAGE_ROLE] == "user"
    assert query in messages[1][MESSAGE_CONTENT]

    span = next(span for span in spans if span.span_kind == SpanKind.EMBEDDING)
    assert span.attributes.get(EMBEDDING_MODEL_NAME) == "text-embedding-ada-002"
    embedding_data = span.attributes[EMBEDDING_EMBEDDINGS]
    assert len(embedding_data) == 1
    embedding_text = embedding_data[0][EMBEDDING_TEXT]
    embedding_vector = embedding_data[0][EMBEDDING_VECTOR]
    assert embedding_text == query
    assert len(embedding_vector) == TEXT_EMBEDDING_ADA_002_EMBEDDING_DIM


def test_callback_data_agent() -> None:
    # Define very simple calculator tools for our agent

    def multiply(a: int, b: int) -> int:
        """Multiple two integers and returns the result integer"""
        return a * b

    multiply_tool = FunctionTool.from_defaults(fn=multiply)

    def add(a: int, b: int) -> int:
        """Add two integers and returns the result integer"""
        return a + b

    add_tool = FunctionTool.from_defaults(fn=add)
    llm = OpenAI(model="gpt-3.5-turbo-0613")
    cb_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    callback_manager = CallbackManager(handlers=[cb_handler])
    agent = OpenAIAgent.from_tools(
        [multiply_tool, add_tool], llm=llm, verbose=True, callback_manager=callback_manager
    )
    agent.query("What is 2 * 3?")

    spans = list(cb_handler.get_spans())
    llm_spans = [span for span in spans if span.span_kind == SpanKind.LLM]
    tool_spans = [span for span in spans if span.span_kind == SpanKind.TOOL]
    # There should be two LLM spans, one to figure out the parameters
    #  and one to complete the calculation
    assert len(llm_spans) == 2
    # one function call
    assert len(tool_spans) == 1
