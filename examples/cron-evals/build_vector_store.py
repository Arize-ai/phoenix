# type: ignore
"""
Builds and persists a LangChain Qdrant vector store over the Arize documentation.
"""

from langchain_community.document_loaders import GitbookLoader
from langchain_community.vectorstores import Qdrant
from langchain_openai import OpenAIEmbeddings

loader = GitbookLoader(
    "https://docs.arize.com/arize/",
    load_all_paths=True,
)
documents = loader.load()
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-large",
)
Qdrant.from_documents(
    documents,
    embeddings,
    path="./vector-store",
    collection_name="arize-documentation",
)
