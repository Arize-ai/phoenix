import argparse
import glob
import itertools
import logging
import os
import pathlib
import re
import sys

from llama_index import LLMPredictor, ServiceContext, VectorStoreIndex
from llama_index.embeddings import OpenAIEmbedding
from llama_index.llms import OpenAI
from llama_index.node_parser import SimpleNodeParser
from llama_index.node_parser.extractors import (
    MetadataExtractor,
    QuestionsAnsweredExtractor,
    SummaryExtractor,
)
from llama_index.schema import Document
from llama_index.text_splitter import SentenceSplitter


def read_markdown_files(directory):
    markdown_files = []
    # Recursively traverse the directory
    for root, _, _ in os.walk(directory):
        # Match markdown files using glob pattern
        markdown_files.extend(glob.glob(os.path.join(root, "*.md")))
    markdown_content = dict()
    for file_path in markdown_files:
        with open(file_path, "r") as file:
            content = file.read()
            markdown_content[file_path] = content
    return markdown_content


def markdown_header_splitter(text):
    splits = []
    header_metadata = []
    current_split = ""
    current_headers = []
    codeblock_delimiters = 0

    def in_codeblock(delimiter_count):
        return delimiter_count % 2 == 1

    def header_level(header):
        pattern = re.compile("(#*)(.*)")
        return len(pattern.match(header).groups()[0])

    lines = text.splitlines()
    for line in lines:
        if line.startswith("```"):
            codeblock_delimiters += 1

        if line.startswith("#") and not in_codeblock(codeblock_delimiters):
            if current_split:
                splits.append(current_split)
                header_metadata.append(current_headers)
            current_split = ""
            current_header_level = header_level(line)
            current_headers = list(
                itertools.takewhile(
                    lambda h: header_level(h) < current_header_level, current_headers
                )
            )
            current_headers.append(line)
        else:
            current_split += f"{line}\n"

    if current_split:
        splits.append(current_split)
        header_metadata.append(current_headers)

    return splits, header_metadata


if __name__ == "__main__":
    logger = logging.getLogger(__name__)
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

    # specify llm
    llm_predictor_chatgpt = LLMPredictor(llm=OpenAI(temperature=0, model_name="gpt-4"))
    service_context = ServiceContext.from_defaults(
        llm_predictor=llm_predictor_chatgpt, chunk_size_limit=1024
    )

    # documents
    logger.info(f"Reading documentation from {args.docs_dir}...")
    docs = []
    docpath = pathlib.Path(args.docs_dir).expanduser()
    markdown_files = read_markdown_files(docpath)
    for filepath, md in markdown_files.items():
        splits, headers = markdown_header_splitter(md)
        for text, header in zip(splits, headers):
            docs.append(Document(text=text, metadata={"headers": header}))

    # nodes
    logger.info("Extracting metadata from each chunk...")
    nodes = SimpleNodeParser.from_defaults(
        chunk_size=1024,
        text_splitter=SentenceSplitter(),
        metadata_extractor=MetadataExtractor(extractors=[QuestionsAnsweredExtractor()]),
    ).get_nodes_from_documents(docs, show_progress=True)
    summarizer = SummaryExtractor(service_context=service_context)
    summaries = summarizer.extract(nodes)

    embed_model = OpenAIEmbedding()
    logger.info("Constructing chunk embeddings from summaries...")
    for node, summary in zip(nodes, summaries):
        node.embedding = embed_model.get_text_embedding(summary["section_summary"])

    # index
    index = VectorStoreIndex(nodes=nodes)
    index.storage_context.persist(persist_dir=args.persist_dir)
    logger.info(f"Persisted index to '{args.persist_dir}'")
