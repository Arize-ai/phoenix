"""
Fetches the Arize documentation from Gitbook and serializes it into LangChain format.
"""

import json
import logging
import sys
from typing import List

from langchain.docstore.document import Document as LangChainDocument
from langchain.document_loaders import GitbookLoader


def load_gitbook_docs(docs_url: str) -> List[LangChainDocument]:
    """Loads documents from a Gitbook URL.

    Args:
        docs_url (str): URL to Gitbook docs.

    Returns:
        List[LangChainDocument]: List of documents in LangChain format.
    """
    loader = GitbookLoader(
        docs_url,
        load_all_paths=True,
    )
    return loader.load()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    # fetch documentation
    docs_url = "https://docs.arize.com/arize/"
    embedding_model_name = "text-embedding-ada-002"
    documents = load_gitbook_docs(docs_url)

    # serialize documents and persist to file
    serialized_documents = [doc.json() for doc in documents]
    with open("arize_docs.json", "w") as f:
        json.dump(serialized_documents, f, indent=4)

    # read persisted data from file, deserialize, and check for equality
    with open("arize_docs.json") as f:
        serialized_documents = json.load(f)
    deserialized_documents = [
        LangChainDocument.parse_raw(serialized_doc) for serialized_doc in serialized_documents
    ]
    assert documents == deserialized_documents
