from llama_index import ListIndex, ServiceContext, get_response_synthesizer
from llama_index.callbacks import CallbackManager
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.schema import Document, TextNode
from phoenix.trace.llama_index import LlamaIndexDebugHandler

nodes = [
    Document(
        text="The Great Pyramid of Giza is one of the seven wonders",
        id="0",
        metadata={"filename": "egypt.txt", "category": "pyramid"},
    ),
    TextNode(text="The Hanging Gardens of Babylon is one of the seven wonders", id="1"),
]


def test_callback_llm(mock_service_context: ServiceContext, capfd) -> None:
    question = "What are the seven wonders of the world?"
    callback_handler = LlamaIndexDebugHandler()
    index = ListIndex(nodes)
    retriever = index.as_retriever(retriever_mode="default")
    response_synthesizer = get_response_synthesizer()

    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
        callback_manager=CallbackManager([callback_handler]),
    )

    query_engine.query(question)
    stdout = capfd.readouterr().out
    assert "EventPayload.NODES" in stdout, "debug handler prints everything in event payload"
    assert "EventPayload.RESPONSE" in stdout, "debug handler prints everything in event payload"
