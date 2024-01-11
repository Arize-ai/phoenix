import json

import pytest
from gcsfs import GCSFileSystem
from llama_index import (
    ServiceContext,
    StorageContext,
    load_index_from_storage,
)
from llama_index.agent import OpenAIAgent
from llama_index.callbacks import CallbackManager
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.graph_stores.simple import SimpleGraphStore
from llama_index.indices.postprocessor import CohereRerank
from llama_index.indices.vector_store import VectorStoreIndex
from llama_index.llms import OpenAI
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.tools import FunctionTool
from phoenix.trace.exporter import NoOpExporter
from phoenix.trace.llama_index import OpenInferenceTraceCallbackHandler
from phoenix.trace.schemas import MimeType, SpanKind
from phoenix.trace.semantic_conventions import (
    EMBEDDING_EMBEDDINGS,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_TEXT,
    EMBEDDING_VECTOR,
    LLM_INPUT_MESSAGES,
    LLM_INVOCATION_PARAMETERS,
    LLM_MODEL_NAME,
    LLM_OUTPUT_MESSAGES,
    LLM_PROMPTS,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    MESSAGE_CONTENT,
    MESSAGE_ROLE,
    MESSAGE_TOOL_CALLS,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    RERANKER_INPUT_DOCUMENTS,
    RERANKER_MODEL_NAME,
    RERANKER_OUTPUT_DOCUMENTS,
    RERANKER_TOP_K,
    TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
    TOOL_CALL_FUNCTION_NAME,
    TOOL_DESCRIPTION,
    TOOL_NAME,
    TOOL_PARAMETERS,
)

TEXT_EMBEDDING_ADA_002_EMBEDDING_DIM = 1536


@pytest.fixture
def model_name(request):
    return request.param


@pytest.fixture(scope="session")
def storage_context() -> StorageContext:
    file_system = GCSFileSystem(project="public-assets-275721")
    index_path = "arize-assets/phoenix/datasets/unstructured/llm/llama-index/arize-docs/index/"
    return StorageContext.from_defaults(
        fs=file_system,
        persist_dir=index_path,
        graph_store=SimpleGraphStore(),  # prevents unauthorized request to GCS
    )


@pytest.fixture
def index(model_name: str, storage_context: StorageContext) -> VectorStoreIndex:
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    service_context = ServiceContext.from_defaults(
        llm=OpenAI(model=model_name, temperature=0),
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


@pytest.mark.parametrize("model_name", ["text-davinci-003", "gpt-3.5-turbo"], indirect=True)
def test_callback_handler_records_llm_and_embedding_attributes_for_query_engine(
    model_name: str,
    query_engine: RetrieverQueryEngine,
) -> None:
    query = "How should timestamps be formatted?"
    response = query_engine.query(query)

    assert "seconds" in response.response.lower()

    tracer = query_engine.callback_manager.handlers[0]._tracer
    spans = list(tracer.get_spans())
    span = next(span for span in spans if span.span_kind == SpanKind.LLM)
    assert span.attributes.get(LLM_MODEL_NAME) == model_name
    assert span.attributes.get(LLM_TOKEN_COUNT_PROMPT, 0) > 0
    assert span.attributes.get(LLM_TOKEN_COUNT_COMPLETION, 0) > 0
    assert span.attributes.get(LLM_TOKEN_COUNT_TOTAL, 0) > 0

    is_chat_model = model_name.startswith("gpt")
    if is_chat_model:
        messages = span.attributes[LLM_INPUT_MESSAGES]
        assert messages[0][MESSAGE_ROLE] == "system"
        assert messages[1][MESSAGE_ROLE] == "user"
        assert query in messages[1][MESSAGE_CONTENT]
    else:
        prompts = span.attributes[LLM_PROMPTS]
        assert len(prompts) == 1
        assert query in prompts[0]

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
    llm = OpenAI(
        model="gpt-3.5-turbo-0613",
        temperature=0,
        additional_kwargs={
            "presence_penalty": 0.002,
            "frequency_penalty": 0.003,
            "n": 2,
        },
    )
    cb_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    callback_manager = CallbackManager(handlers=[cb_handler])
    agent = OpenAIAgent.from_tools(
        [multiply_tool, add_tool], llm=llm, verbose=True, callback_manager=callback_manager
    )
    agent.query("What is 2 * 3?")

    spans = sorted(cb_handler.get_spans(), key=lambda span: span.start_time)
    llm_spans = [span for span in spans if span.span_kind == SpanKind.LLM]
    tool_spans = [span for span in spans if span.span_kind == SpanKind.TOOL]
    # There should be two LLM spans, one to figure out the parameters
    #  and one to complete the calculation
    assert len(llm_spans) == 2
    for llm_span in llm_spans:
        assert json.loads(llm_span.attributes[LLM_INVOCATION_PARAMETERS]) == {
            "frequency_penalty": 0.003,
            "model": "gpt-3.5-turbo-0613",
            "n": 2,
            "presence_penalty": 0.002,
            "temperature": 0,
        }
    assert llm_spans[0].attributes[OUTPUT_MIME_TYPE] is MimeType.JSON
    assert json.loads(llm_spans[0].attributes[OUTPUT_VALUE])["tool_calls"][0]["function"] == {
        "name": "multiply",
        "arguments": '{\n  "a": 2,\n  "b": 3\n}',
    }
    assert llm_spans[0].attributes[LLM_INPUT_MESSAGES] == [
        {
            MESSAGE_CONTENT: "What is 2 * 3?",
            MESSAGE_ROLE: "user",
        }
    ]
    assert llm_spans[0].attributes[LLM_OUTPUT_MESSAGES] == [
        {
            MESSAGE_TOOL_CALLS: [
                {
                    TOOL_CALL_FUNCTION_ARGUMENTS_JSON: '{\n  "a": 2,\n  "b": 3\n}',
                    TOOL_CALL_FUNCTION_NAME: "multiply",
                },
            ],
            MESSAGE_ROLE: "assistant",
        },
        {
            MESSAGE_TOOL_CALLS: [
                {
                    TOOL_CALL_FUNCTION_ARGUMENTS_JSON: '{\n  "a": 2,\n  "b": 3\n}',
                    TOOL_CALL_FUNCTION_NAME: "multiply",
                },
            ],
            MESSAGE_ROLE: "assistant",
        },
    ]
    assert llm_spans[1].attributes[OUTPUT_MIME_TYPE] is MimeType.TEXT
    assert llm_spans[1].attributes[OUTPUT_VALUE] in (
        "2 multiplied by 3 equals 6.",
        "2 multiplied by 3 is equal to 6.",
    )
    assert llm_spans[1].attributes.get(LLM_INPUT_MESSAGES) == [
        {
            MESSAGE_ROLE: "user",
            MESSAGE_CONTENT: "What is 2 * 3?",
        },
        {
            MESSAGE_ROLE: "assistant",
            MESSAGE_CONTENT: None,
            MESSAGE_TOOL_CALLS: [
                {
                    TOOL_CALL_FUNCTION_ARGUMENTS_JSON: '{\n  "a": 2,\n  "b": 3\n}',
                    TOOL_CALL_FUNCTION_NAME: "multiply",
                },
            ],
        },
        {
            MESSAGE_ROLE: "tool",
            MESSAGE_CONTENT: "6",
            "message.name": "multiply",
        },
    ]
    assert llm_spans[1].attributes[LLM_OUTPUT_MESSAGES] == [
        {
            MESSAGE_CONTENT: llm_spans[1].attributes[OUTPUT_VALUE],
            MESSAGE_ROLE: "assistant",
        },
        {
            MESSAGE_CONTENT: llm_spans[1].attributes[OUTPUT_VALUE],
            MESSAGE_ROLE: "assistant",
        },
    ]
    # one function call
    assert len(tool_spans) == 1
    tool_span = tool_spans[0]
    assert tool_span.attributes[TOOL_NAME] == "multiply"
    assert (
        tool_span.attributes[TOOL_DESCRIPTION]
        == "multiply(a: int, b: int) -> int\nMultiple two integers and returns the result integer"
    )
    assert tool_span.attributes[TOOL_PARAMETERS] == {
        "properties": {
            "a": {"title": "A", "type": "integer"},
            "b": {"title": "B", "type": "integer"},
        },
        "required": ["a", "b"],
        "title": "multiply",
        "type": "object",
    }


@pytest.mark.parametrize("model_name", ["text-davinci-003"], indirect=True)
def test_cohere_rerank(index: VectorStoreIndex) -> None:
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    service_context = ServiceContext.from_defaults(
        callback_manager=CallbackManager(handlers=[callback_handler])
    )
    cohere_rerank = CohereRerank(top_n=2)
    query_engine = index.as_query_engine(
        similarity_top_k=5,
        node_postprocessors=[cohere_rerank],
        service_context=service_context,
    )
    query_engine.query("How should timestamps be formatted?")

    spans = {span.name: span for span in callback_handler.get_spans()}
    assert "reranking" in spans
    reranker_span = spans["reranking"]
    assert reranker_span.span_kind == SpanKind.RERANKER
    assert (
        len(reranker_span.attributes[RERANKER_INPUT_DOCUMENTS])
        == query_engine.retriever.similarity_top_k
    )
    assert len(reranker_span.attributes[RERANKER_OUTPUT_DOCUMENTS]) == cohere_rerank.top_n
    assert reranker_span.attributes[RERANKER_TOP_K] == cohere_rerank.top_n
    assert reranker_span.attributes[RERANKER_MODEL_NAME] == cohere_rerank.model
