"""
Builds and persists an index of the Arize docs using the LlamaHub MarkdownReader. This script
requires that you have cloned the private Arize docs repo locally. It produces the indexes used in
the LlamaIndex tutorial notebooks. The chunks produced by the MarkdownReader are small in size and
are good for demo purposes.

https://llamahub.ai/l/file-markdown
"""

import argparse
import logging
import sys
from pathlib import Path

from llama_index import VectorStoreIndex, download_loader

logger = logging.getLogger(__name__)


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

    MarkdownReader = download_loader("MarkdownReader")
    loader = MarkdownReader()
    documents = []
    for markdown_file_path in Path(args.docs_dir).glob("**/*.md"):
        documents.extend(loader.load_data(file=markdown_file_path))

    index = VectorStoreIndex.from_documents(documents)
    index.storage_context.persist(persist_dir=args.persist_dir)

    logger.info(f"Persisted index to '{args.persist_dir}' directory.")
