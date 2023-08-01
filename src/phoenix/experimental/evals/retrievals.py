"""
Helper functions for evaluating the retrieval step of retrieval-augmented generation.
"""

from typing import List, Optional, Tuple

import openai
from tenacity import (
    retry,
    stop_after_attempt,
    wait_random_exponential,
)

_EVALUATION_SYSTEM_MESSAGE = (
    "You will be given a query and a reference text. "
    "You must determine whether the reference text contains an answer to the input query. "
    'Your response must be single word, either "relevant" or "irrelevant", '
    "and should not contain any text or characters aside from that word. "
    '"irrelevant" means that the reference text does not contain an answer to the query. '
    '"relevant" means the reference text contains an answer to the query.'
)
_QUERY_CONTEXT_PROMPT_TEMPLATE = """# Query: {query}

# Reference: {reference}

# Answer ("relevant" or "irrelevant"): """


def compute_precisions_at_k_and_relevance_classifications(
    query_texts: List[str],
    list_of_retrieved_document_texts: List[List[str]],
    model_name: str = "gpt-4",
) -> Tuple[List[List[Optional[float]]], List[List[Optional[bool]]]]:
    if len(query_texts) != len(list_of_retrieved_document_texts):
        raise ValueError()
    list_of_precisions_at_k_lists: List[List[Optional[float]]] = []
    list_of_relevance_classifications_lists: List[List[Optional[bool]]] = []
    for query_text, retrieved_document_texts in zip(query_texts, list_of_retrieved_document_texts):
        relevance_classifications = [
            classify_relevance(query_text, document, model_name=model_name)
            for document in retrieved_document_texts
        ]
        precisions_at_k = compute_precisions_at_k(relevance_classifications)
        list_of_relevance_classifications_lists.append(relevance_classifications)
        list_of_precisions_at_k_lists.append(precisions_at_k)
    return list_of_precisions_at_k_lists, list_of_relevance_classifications_lists


def compute_precisions_at_k(
    relevance_classifications: List[Optional[bool]],
) -> List[Optional[float]]:
    precisions_at_k = []
    num_relevant_classifications = 0
    num_non_none_classifications = 0
    for relevance_classification in relevance_classifications:
        if isinstance(relevance_classification, bool):
            num_non_none_classifications += 1
            num_relevant_classifications += int(relevance_classification)
        precisions_at_k.append(
            num_relevant_classifications / num_non_none_classifications
            if num_non_none_classifications > 0
            else None
        )
    return precisions_at_k


@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def classify_relevance(query: str, document: str, model_name: str) -> Optional[bool]:
    prompt = _QUERY_CONTEXT_PROMPT_TEMPLATE.format(
        query=query,
        reference=document,
    )
    response = openai.ChatCompletion.create(
        messages=[
            {"role": "system", "content": _EVALUATION_SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
        model=model_name,
    )
    raw_response_text = str(response["choices"][0]["message"]["content"]).strip()
    relevance_classification = {"relevant": True, "irrelevant": False}.get(raw_response_text)
    return relevance_classification
