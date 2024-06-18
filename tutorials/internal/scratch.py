import tempfile
from typing import Any, Mapping
from urllib.request import urlretrieve

import phoenix as px
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.postprocessor import SentenceTransformerRerank
from llama_index.core.settings import Settings
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.llms.ollama import Ollama
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from phoenix.datasets.decorators import io_capture
from phoenix.datasets.experiments import run_experiment
from wrapt import wrap_function_wrapper

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))

LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)

ds = px.Client().get_dataset("RGF0YXNldDoy")

Settings.llm = Ollama(model="llama3")
Settings.embed_model = OllamaEmbedding(model_name="mxbai-embed-large")

essay = "https://raw.githubusercontent.com/run-llama/llama_index/main/docs/docs/examples/data/paul_graham/paul_graham_essay.txt"
with tempfile.NamedTemporaryFile() as tf:
    urlretrieve(essay, tf.name)
    documents = SimpleDirectoryReader(input_files=[tf.name]).load_data()
index = VectorStoreIndex.from_documents(documents)

reranker = SentenceTransformerRerank(model="cross-encoder/ms-marco-MiniLM-L-2-v2", top_n=3)
chat_engine = index.as_chat_engine(similarity_top_k=10, node_postprocessors=[reranker])


def ollama_with_cross_encoder(inputs: Mapping[str, Any]) -> str:
    response = chat_engine.chat(inputs["input_messages"][-1]["content"])
    return str(response)


wrap_function_wrapper(
    module="llama_index.core.postprocessor.types",
    name="BaseNodePostprocessor.postprocess_nodes",
    wrapper=io_capture(
        identifier="documents", transform_output=lambda nodes: [node.text for node in nodes]
    ).sync_wrapper,
)

if __name__ == "__main__":
    run_experiment(ds, ollama_with_cross_encoder)
