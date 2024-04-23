"""
Creates RAG dataset for tutorial notebooks and persists to disk.
"""

import argparse
import logging
import sys
from typing import List, Optional

import llama_index
import numpy as np
import pandas as pd
from gcsfs import GCSFileSystem
from llama_index import ServiceContext, StorageContext, load_index_from_storage
from llama_index.callbacks import CallbackManager, OpenInferenceCallbackHandler
from llama_index.callbacks.open_inference_callback import as_dataframe
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms import OpenAI
from phoenix.evals.retrievals import (
    classify_relevance,
    compute_precisions_at_k,
)
from tqdm import tqdm


def create_user_feedback(
    first_document_relevances: List[Optional[bool]],
    second_document_relevances: List[Optional[bool]],
) -> List[Optional[bool]]:
    """_summary_

    Args:
        first_document_relevances (List[Optional[bool]]): _description_
        second_document_relevances (List[Optional[bool]]): _description_

    Returns:
        List[Optional[bool]]: _description_
    """
    if len(first_document_relevances) != len(second_document_relevances):
        raise ValueError()
    first_document_relevances_array = np.array(first_document_relevances)
    second_document_relevances_array = np.array(second_document_relevances)
    failed_retrieval_mask = ~first_document_relevances_array & ~second_document_relevances_array
    num_failed_retrievals = failed_retrieval_mask.sum()
    num_thumbs_down = int(0.75 * num_failed_retrievals)
    failed_retrieval_indexes = np.where(failed_retrieval_mask)[0]
    thumbs_down_mask = np.random.choice(
        failed_retrieval_indexes, size=num_thumbs_down, replace=False
    )
    successful_retrieval_mask = ~failed_retrieval_mask
    num_successful_retrievals = successful_retrieval_mask.sum()
    num_thumbs_up = int(0.25 * num_successful_retrievals)
    successful_retrieval_indexes = np.where(successful_retrieval_mask)[0]
    thumbs_up_mask = np.random.choice(
        successful_retrieval_indexes, size=num_thumbs_up, replace=False
    )
    user_feedback_array = np.full(len(first_document_relevances), np.nan, dtype=np.float32)
    user_feedback_array[thumbs_down_mask] = -1.0
    user_feedback_array[thumbs_up_mask] = 1.0
    return [None if np.isnan(value) else value for value in user_feedback_array.tolist()]


if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)

    parser = argparse.ArgumentParser()
    parser.add_argument("--index-path", type=str, required=True, help="Path to persisted index.")
    parser.add_argument(
        "--use-gcs",
        action="store_true",
        help="If this flag is set, the index will be loaded from GCS.",
    )
    parser.add_argument(
        "--query-path", type=str, required=True, help="Path to CSV file containing queries."
    )
    parser.add_argument(
        "--output-path", type=str, required=True, help="Path to output Parquet file."
    )
    args = parser.parse_args()

    llama_index.prompts.default_prompts.DEFAULT_TEXT_QA_PROMPT_TMPL = (
        "Context information is below.\n"
        "---------------------\n"
        "{context_str}\n"
        "---------------------\n"
        "Given the context information, "
        "answer the question and be as helpful as possible: {query_str}\n"
    )  # This prompt has been tweaked to make the system less conservative for demo purposes.

    queries = pd.read_csv(args.query_path)["Question"].tolist()
    file_system = GCSFileSystem(project="public-assets-275721") if args.use_gcs else None
    storage_context = StorageContext.from_defaults(
        fs=file_system,
        persist_dir=args.index_path,
    )
    callback_handler = OpenInferenceCallbackHandler()
    service_context = ServiceContext.from_defaults(
        llm=OpenAI(model="text-davinci-003"),
        embed_model=OpenAIEmbedding(model="text-embedding-ada-002"),
        callback_manager=CallbackManager(handlers=[callback_handler]),
    )
    index = load_index_from_storage(
        storage_context,
        service_context=service_context,
    )
    query_engine = index.as_query_engine()

    logging.info("Running queries")
    for query in tqdm(queries):
        query_engine.query(query)

    query_dataframe = as_dataframe(callback_handler.flush_query_data_buffer())
    document_dataframe = as_dataframe(callback_handler.flush_node_data_buffer())

    query_texts = query_dataframe[":feature.text:prompt"].tolist()
    list_of_document_id_lists = query_dataframe[
        ":feature.[str].retrieved_document_ids:prompt"
    ].tolist()
    document_id_to_text = dict(
        zip(document_dataframe["id"].to_list(), document_dataframe["node_text"].to_list())
    )
    first_document_texts, second_document_texts = [
        [
            document_id_to_text[document_ids[document_index]]
            for document_ids in list_of_document_id_lists
        ]
        for document_index in [0, 1]
    ]

    logging.info("Computing LLM-assisted ranking metrics")
    first_document_relevances, second_document_relevances = [
        [
            classify_relevance(query_text, document_text, model_name="gpt-4")
            for query_text, document_text in tqdm(zip(query_texts, first_document_texts))
        ]
        for document_texts in [first_document_texts, second_document_texts]
    ]
    list_of_precisions_at_k_lists = [
        compute_precisions_at_k([rel0, rel1])
        for rel0, rel1 in zip(first_document_relevances, second_document_relevances)
    ]
    precisions_at_1, precisions_at_2 = [
        [precisions_at_k[index] for precisions_at_k in list_of_precisions_at_k_lists]
        for index in [0, 1]
    ]
    document_similarity_0, document_similarity_1 = [
        [
            scores[index]
            for scores in query_dataframe[
                ":feature.[float].retrieved_document_scores:prompt"
            ].tolist()
        ]
        for index in [0, 1]
    ]
    user_feedback = create_user_feedback(first_document_relevances, second_document_relevances)
    logging.info(
        f"Thumbs up: {sum([value == 1.0 for value in  user_feedback]) / len(user_feedback)}"
    )
    logging.info(
        f"Thumbs down: {sum([value == -1.0 for value in  user_feedback]) / len(user_feedback)}"
    )

    query_dataframe = query_dataframe.assign(
        **{
            ":tag.bool:relevance_0": first_document_relevances,
            ":tag.bool:relevance_1": second_document_relevances,
            ":tag.float:precision_at_1": precisions_at_1,
            ":tag.float:precision_at_2": precisions_at_2,
            ":tag.float:document_similarity_0": document_similarity_0,
            ":tag.float:document_similarity_1": document_similarity_1,
            ":tag.float:user_feedback": user_feedback,
        }
    )
    query_dataframe.to_parquet(args.output_path)
