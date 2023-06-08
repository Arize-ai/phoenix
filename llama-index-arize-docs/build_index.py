"""
Build and persist index of the Arize docs using Llama Index.
"""


import argparse
import logging
import sys
from pathlib import Path

from llama_index import VectorStoreIndex, download_loader

logger = logging.getLogger(__name__)


def main(docs_dir: str, persist_dir: str) -> None:
    index = build_index(docs_dir)
    persist_index(index, persist_dir)
    logging.info(f"Persisted index to '{persist_dir}' directory.")


def build_index(docs_dir: str) -> VectorStoreIndex:
    MarkdownReader = download_loader("MarkdownReader")
    loader = MarkdownReader()
    documents = []
    for markdown_file_path in Path(docs_dir).glob("**/*.md"):
        documents.extend(loader.load_data(file=markdown_file_path))
    return VectorStoreIndex.from_documents(documents)


def persist_index(index: VectorStoreIndex, persist_dir: str) -> None:
    index.storage_context.persist(persist_dir=persist_dir)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "docs_dir",
        type=str,
        help="Path to Arize docs repo.",
    )
    parser.add_argument(
        "persist_dir",
        type=str,
        help="Path to directory where index will be persisted.",
    )
    args = parser.parse_args()

    main(args.docs_dir, args.persist_dir)
