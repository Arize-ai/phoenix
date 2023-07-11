import os
import tempfile
import textwrap
import urllib
import zipfile
from typing import List, Tuple

from langchain.chat_models import ChatOpenAI
from llama_index import LLMPredictor, ServiceContext, StorageContext, load_index_from_storage
from llama_index.callbacks import ArizeCallbackHandler, CallbackManager
from llama_index.embeddings.base import BaseEmbedding
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.indices.query.schema import QueryBundle
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.response.schema import Response


def download_file(url: str, output_path: str) -> None:
    """
    Downloads a file from the specified URL and saves to a local path.
    """
    urllib.request.urlretrieve(url, output_path)


def unzip_directory(zip_path: str, output_path: str) -> None:
    """
    Unzips a directory to a specified output path.
    """
    with zipfile.ZipFile(zip_path, "r") as f:
        f.extractall(output_path)


index_dir = "index"
if not os.path.isdir(index_dir):
    print("⏳ Downloading knowledge base...")
    data_dir = tempfile.gettempdir()
    zip_file_path = os.path.join(data_dir, "index.zip")
    download_file(
        url="http://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/llm/llama-index/arize-docs/index.zip",
        output_path=zip_file_path,
    )

    print("⏳ Unzipping knowledge base...")
    unzip_directory(zip_file_path, index_dir)

    print("✅ Done")

# configure the embedding model
embedding_model_name = "text-embedding-ada-002"
embedding_model = OpenAIEmbedding(model=embedding_model_name)

# configure the model to synthesize the final response after context retrieval
service_context_model_name = "gpt-3.5-turbo"
llm_predictor = LLMPredictor(llm=ChatOpenAI(model_name=service_context_model_name, temperature=0))
arize_callback = ArizeCallbackHandler()
callback_manager = CallbackManager([arize_callback])
service_context = ServiceContext.from_defaults(
    llm_predictor=llm_predictor,
    callback_manager=callback_manager,
)

# load the index from disc
storage_context = StorageContext.from_defaults(
    persist_dir=os.path.join(index_dir),
)
index = load_index_from_storage(
    storage_context,
    service_context=service_context,
)

# instantiate a query engine
query_engine = index.as_query_engine()


def get_response_and_query_embedding(
    query_engine: RetrieverQueryEngine, query: str, embedding_model: BaseEmbedding
) -> Tuple[Response, List[float]]:
    """
    Queries the query engine and returns the response and query embedding used
    to retrieve context from the database.
    """

    query_embedding = embedding_model.get_text_embedding(query)
    query_bundle = QueryBundle(query, embedding=query_embedding)
    response = query_engine.query(query_bundle)
    return response, query_embedding


def display_llama_index_response(response: Response) -> None:
    """
    Displays a LlamaIndex response and its retrieved context.
    """

    print("Response")
    print("========")
    for line in textwrap.wrap(response.response.strip(), width=80):
        print(line)
    print()

    print("Retrieved Context")
    print("=================")
    print()

    for source_node in response.source_nodes:
        print(f"doc_id: {source_node.node.id_}")
        print(f"score: {source_node.score}")
        print()
        for line in textwrap.wrap(source_node.node.text, width=80):
            print(line)
        print()


query = "What's the difference between primary and baseline datasets?"
# query = "How do I send in extra metadata with each record?"
# query = "How does Arize's surrogate explainability model work?"
response, query_embedding = get_response_and_query_embedding(
    query_engine,
    query,
    embedding_model,
)

display_llama_index_response(response)
print("Embedding Dimension")
print("===================")
print(len(query_embedding))
