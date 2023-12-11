"""
Builds an index for the Arize documentation using LangChain and Pinecone.

To run, you must first create an account with Pinecone and create an index in the UI with the
appropriate embedding dimension (1536 if you are using text-embedding-ada-002 like this script). You
also need an OpenAI API key. This implementation relies on the fact that the Arize documentation is
written and hosted with Gitbook. If your documentation does not use Gitbook, you should use a
different document loader.
"""

import argparse
import logging
import sys
from functools import partial
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import pinecone  # type: ignore
import tiktoken
from langchain.docstore.document import Document
from langchain.document_loaders import GitbookLoader
from langchain.embeddings.base import Embeddings
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import Pinecone
from tiktoken import Encoding


def load_gitbook_docs(docs_url: str) -> List[Document]:
    """
    Loads documentation from a Gitbook URL.
    """

    loader = GitbookLoader(
        docs_url,
        load_all_paths=True,
    )
    return loader.load()


def tiktoken_len(text: str, tokenizer: Encoding) -> int:
    """
    Returns the number of tokens in a text.
    """

    tokens = tokenizer.encode(text, disallowed_special=())
    return len(tokens)


def chunk_docs(documents: List[Document], embedding_model_name: str) -> List[Document]:
    """
    Chunks the documents.

    The chunking strategy used in this function is from the following notebook and accompanying
    video:

    - https://github.com/pinecone-io/examples/blob/master/generation/langchain/handbook/
      xx-langchain-chunking.ipynb
    - https://www.youtube.com/watch?v=eqOfr4AGLk8
    """

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=400,
        chunk_overlap=20,
        length_function=partial(
            tiktoken_len, tokenizer=tiktoken.encoding_for_model(embedding_model_name)
        ),
        separators=["\n\n", "\n", " ", ""],
    )
    return text_splitter.split_documents(documents)


def build_pinecone_index(
    documents: List[Document], embeddings: Embeddings, index_name: str
) -> None:
    """
    Builds a Pinecone index from a list of documents.
    """

    Pinecone.from_documents(documents, embeddings, index_name=pinecone_index_name)


def save_dataframe_to_parquet(dataframe: pd.DataFrame, save_path: str) -> None:
    """
    Saves a dataframe to parquet.
    """

    dataframe.to_parquet(save_path)


class OpenAIEmbeddingsWrapper(OpenAIEmbeddings):
    """
    Wrapper around OpenAIEmbeddings that stores the query and document embeddings in memory.
    """

    query_text_to_embedding: Dict[str, List[float]] = {}
    document_text_to_embedding: Dict[str, List[float]] = {}

    def embed_query(self, text: str) -> List[float]:
        embedding = super().embed_query(text)
        self.query_text_to_embedding[text] = embedding
        return embedding

    def embed_documents(self, texts: List[str], chunk_size: Optional[int] = 0) -> List[List[float]]:
        embeddings = super().embed_documents(texts, chunk_size)
        for text, embedding in zip(texts, embeddings):
            self.document_text_to_embedding[text] = embedding
        return embeddings

    @property
    def query_embedding_dataframe(self) -> pd.DataFrame:
        return self._convert_text_to_embedding_map_to_dataframe(self.query_text_to_embedding)

    @property
    def document_embedding_dataframe(self) -> pd.DataFrame:
        return self._convert_text_to_embedding_map_to_dataframe(self.document_text_to_embedding)

    @staticmethod
    def _convert_text_to_embedding_map_to_dataframe(
        text_to_embedding: Dict[str, List[float]],
    ) -> pd.DataFrame:
        texts, embeddings = map(list, zip(*text_to_embedding.items()))
        embedding_arrays = [np.array(embedding) for embedding in embeddings]
        return pd.DataFrame.from_dict(
            {
                "text": texts,
                "text_vector": embedding_arrays,
            }
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    parser = argparse.ArgumentParser()
    parser.add_argument("--pinecone-api-key", type=str, help="Pinecone API key")
    parser.add_argument("--pinecone-index-name", type=str, help="Pinecone index name")
    parser.add_argument("--pinecone-environment", type=str, help="Pinecone environment")
    parser.add_argument("--openai-api-key", type=str, help="OpenAI API key")
    parser.add_argument(
        "--output-parquet-path", type=str, help="Path to output parquet file for index"
    )
    args = parser.parse_args()

    pinecone_api_key = args.pinecone_api_key
    pinecone_index_name = args.pinecone_index_name
    pinecone_environment = args.pinecone_environment
    output_parquet_path = args.output_parquet_path

    pinecone.init(api_key=pinecone_api_key, environment=pinecone_environment)

    docs_url = "https://docs.arize.com/arize/"
    embedding_model_name = "text-embedding-ada-002"
    documents = load_gitbook_docs(docs_url)
    documents = chunk_docs(documents, embedding_model_name=embedding_model_name)
    embeddings = OpenAIEmbeddingsWrapper(model=embedding_model_name)  # type: ignore
    build_pinecone_index(documents, embeddings, pinecone_index_name)
    save_dataframe_to_parquet(embeddings.document_embedding_dataframe, output_parquet_path)
