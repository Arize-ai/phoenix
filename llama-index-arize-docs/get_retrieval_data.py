"""
Generate responses for input queries.
"""

import argparse
import logging
import sys
from collections import defaultdict
from typing import List

import pandas as pd
from langchain.chat_models import ChatOpenAI
from llama_index import StorageContext, VectorStoreIndex, load_index_from_storage
from tenacity import (
    retry,
    stop_after_attempt,
    wait_random_exponential,
)
from tqdm import tqdm

logger = logging.getLogger(__name__)


def load_queries(csv_path: str) -> List[str]:
    return pd.read_csv(csv_path)["Question"].tolist()


def load_index_as_query_engine(index_dir: str):
    storage_context = StorageContext.from_defaults(
        persist_dir=index_dir,
    )
    llm = ChatOpenAI(model_name="gpt-4")
    index = load_index_from_storage(storage_context, llm=llm)
    return index.as_query_engine()


@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def generate_response(query_engine: VectorStoreIndex, query: str) -> dict:
    response = query_engine.query(query)
    response_data = {}
    response_data["query_text"] = query
    response_data["query_embedding"] = response.extra_info["query_embedding"]
    response_data["response"] = response.response
    for source_node_index, source_node in enumerate(response.source_nodes):
        response_data[f"context_doc_id_{source_node_index}"] = source_node.node.ref_doc_id
        response_data[f"context_text_{source_node_index}"] = source_node.node.text
        response_data[f"context_similarity_{source_node_index}"] = source_node.score
    return response_data


def create_dataframe(responses: List[dict]) -> pd.DataFrame:
    dataframe_data = defaultdict(list)
    for response_data in responses:
        for key, value in response_data.items():
            dataframe_data[key].append(value)
    return pd.DataFrame(dataframe_data)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "queries_csv_path",
        type=str,
        help="Path to CSV file containing queries.",
    )
    parser.add_argument(
        "index_dir",
        type=str,
        help="Path to directory where index is persisted.",
    )
    parser.add_argument(
        "parquet_save_path",
        type=str,
        help="Path to output parquet file.",
    )
    args = parser.parse_args()

    queries = load_queries(args.queries_csv_path)
    query_engine = load_index_as_query_engine(args.index_dir)

    responses = []
    for query in tqdm(queries):
        responses.append(generate_response(query_engine, query))

    retrievals_df = create_dataframe(responses)
    retrievals_df.to_parquet(args.parquet_save_path)
    logging.info(f"Saved parquet file to '{args.parquet_save_path}'.")
