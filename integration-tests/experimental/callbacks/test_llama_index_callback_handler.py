import pytest
from gcsfs import GCSFileSystem
from llama_index import ServiceContext, StorageContext, load_index_from_storage
from llama_index.agent import OpenAIAgent
from llama_index.callbacks import CallbackManager
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.graph_stores.simple import SimpleGraphStore
from llama_index.indices.vector_store import VectorStoreIndex
from llama_index.llms import ChatMessage, MessageRole, OpenAI
from llama_index.query_engine import RetrieverQueryEngine
from phoenix.experimental.callbacks.llama_index_trace_callback_handler import (
    OpenInferenceTraceCallbackHandler,
)
from phoenix.trace.schemas import SpanKind

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
    callback_handler = OpenInferenceTraceCallbackHandler()
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
    span = next(span for span in tracer.span_buffer if span.span_kind == SpanKind.LLM)
    messages = span.attributes["llm.messages"]

    role, _ = messages[0]
    assert role == "system"

    role, message_text = messages[1]
    assert role == "user"
    assert query in message_text

    span = next(span for span in tracer.span_buffer if span.span_kind == SpanKind.EMBEDDING)
    embedding_texts = span.attributes["embedding.text"]
    embedding_vectors = span.attributes["embedding.vector"]
    assert len(embedding_texts) == len(embedding_vectors) == 1
    assert embedding_texts[0] == query
    assert len(embedding_vectors[0]) == TEXT_EMBEDDING_ADA_002_EMBEDDING_DIM


# TODO: implement test after bug with OpenAIAgent callback is fixed
def test_agent(agent: OpenAIAgent) -> None:
    response = agent.chat(
        "Can you explain what that means?",
        chat_history=[
            ChatMessage(role=MessageRole.USER, content="What is Arize?"),
            ChatMessage(
                role=MessageRole.ASSISTANT, content="Arize is a ML observability platform."
            ),
        ],
    )

    tracer = agent.callback_manager.handlers[0]._tracer

    next(span for span in tracer.span_buffer if span.span_kind == SpanKind.LLM)
    assert response == "Arize is a ML observability platform."
