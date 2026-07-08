# type: ignore
"""
Loads a pre-built Qdrant vector store and defines a simple `RetrievalQA` chain.
Downloads a set of queries and invokes the chain on loop to simulate a
production environment with continuously incoming traces and spans.

Note: You must first build the Qdrant vector store using the
`build_vector_store.py` script before running this script.
"""

from itertools import cycle

import pandas as pd
from langchain.chains import RetrievalQA
from langchain_community.vectorstores import Qdrant
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from qdrant_client import QdrantClient


def get_chain():
    """
    Loads a pre-built Qdrant vector store and defines a simple `RetrievalQA` chain.
    """
    qdrant_client = QdrantClient(path="./vector-store")
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-large",
    )
    vector_store = Qdrant(
        client=qdrant_client,
        collection_name="arize-documentation",
        embeddings=embeddings,
    )
    retriever = vector_store.as_retriever(
        search_type="mmr", search_kwargs={"k": 2}, enable_limit=True
    )
    llm = ChatOpenAI(model="gpt-4-turbo-preview", temperature=0.0)
    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        metadata={"application_type": "question_answering"},
    )


def instrument_langchain():
    """
    Instruments LangChain with OpenInference.
    """
    endpoint = "http://127.0.0.1:6006/v1/traces"
    tracer_provider = trace_sdk.TracerProvider()
    trace_api.set_tracer_provider(tracer_provider)
    tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
    LangChainInstrumentor().instrument()


def load_queries():
    """
    Loads a set of queries from a parquet file.
    """
    return pd.read_parquet(
        "http://storage.googleapis.com/arize-phoenix-assets/datasets/unstructured/llm/context-retrieval/langchain-pinecone/langchain_pinecone_query_dataframe_with_user_feedbackv2.parquet"  # noqa E501
    ).text.to_list()


if __name__ == "__main__":
    queries = load_queries()
    chain = get_chain()
    instrument_langchain()
    for query in cycle(queries):
        response = chain.invoke(query)
        print("Query")
        print("=====")
        print(query)
        print()
        print("Response")
        print("========")
        print(response)
        print()
