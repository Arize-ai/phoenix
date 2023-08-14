from llama_index import ListIndex, get_response_synthesizer
from llama_index.indices.service_context import ServiceContext
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.schema import TextNode
from phoenix.experimental.callbacks.llama_index_trace_callback_handler import (
    OpenInferenceTraceCallbackHandler,
)

nodes = [
    TextNode(text="The Great Pyramid of Giza is one of the seven wonders", id="0"),
    TextNode(text="The Hanging Gardens of Babylon is one of the seven wonders", id="1"),
]


def test_callback_llm(mock_service_context: ServiceContext) -> None:
    question = "What are the seven wonders of the world?"
    OpenInferenceTraceCallbackHandler()
    index = ListIndex(nodes)
    retriever = index.as_retriever(retriever_mode="default")
    response_synthesizer = get_response_synthesizer(service_context=mock_service_context)

    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
    )

    response = query_engine.query(question)
    print(response)
    assert True is True
