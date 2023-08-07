"""
Creates RAG dataset for LlamaIndex and uploads to cloud storage.
"""

import logging
import sys
from typing import List, Optional

import numpy as np
from gcsfs import GCSFileSystem
from langchain.chat_models import ChatOpenAI
from llama_index import ServiceContext, StorageContext, load_index_from_storage
from llama_index.callbacks import CallbackManager, OpenInferenceCallbackHandler
from llama_index.callbacks.open_inference_callback import as_dataframe
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.graph_stores.simple import SimpleGraphStore
from llama_index.llms import LangChainLLM
from phoenix.experimental.evals.retrievals import (
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
    failed_retrieval_mask = (first_document_relevances_array is False) & (
        second_document_relevances_array is False
    )
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
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    file_system = GCSFileSystem(project="public-assets-275721")
    index_path = "arize-assets/phoenix/datasets/unstructured/llm/llama-index/arize-docs/index/"
    storage_context = StorageContext.from_defaults(
        fs=file_system,
        persist_dir=index_path,
        graph_store=SimpleGraphStore(),  # prevents unauthorized request to GCS
    )
    callback_handler = OpenInferenceCallbackHandler()
    chat_model = ChatOpenAI(model_name="gpt-3.5-turbo")  # type: ignore
    service_context = ServiceContext.from_defaults(
        llm=LangChainLLM(chat_model),
        embed_model=OpenAIEmbedding(model="text-embedding-ada-002"),
        callback_manager=CallbackManager(handlers=[callback_handler]),
    )
    index = load_index_from_storage(
        storage_context,
        service_context=service_context,
    )
    query_engine = index.as_query_engine()

    for query in tqdm(
        [
            "How do I get an Arize API key?",
            "Can I create monitors with an API?",
            "How do I need to format timestamps?",
            "What is the price of the Arize platform",
        ]
    ):
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
    first_document_relevances, second_document_relevances = [
        [
            classify_relevance(query_text, document_text, model_name="gpt-4")
            for query_text, document_text in zip(query_texts, first_document_texts)
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

    gcs = GCSFileSystem(project="public-assets-275721")
    with gcs.open(
        "arize-assets/phoenix/datasets/unstructured/llm/llama-index/arize-docs/index/query_data_complete4.parquet",
        "w",
    ) as file:
        query_dataframe.to_parquet(file, index=False)
