"""
Helper functions for evaluating the retrieval step of retrieval-augmented generation.
"""

from typing import List, Optional

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


def compute_precisions_at_k(
    relevance_classifications: List[Optional[bool]],
) -> List[Optional[float]]:
    """Given a list of relevance classifications, computes precision@k for k = 1, 2, ..., n, where
    n is the length of the input list.

    Args:
        relevance_classifications (List[Optional[bool]]): A list of relevance classifications for a
            set of retrieved documents, sorted by order of retrieval (i.e., the first element is the
            classification for the first retrieved document, the second element is the
            classification for the second retrieved document, etc.). The list may contain None
            values, which indicate that the relevance classification for the corresponding document
            is unknown.

    Returns:
        List[Optional[float]]: A list of precision@k values for k = 1, 2, ..., n, where n is the
            length of the input list. The first element is the precision@1 value, the second element
            is the precision@2 value, etc. If the input list contains any None values, those values
            are omitted when computing the precision@k values.
    """
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


def classify_relevance(query: str, document: str, model_name: str) -> Optional[bool]:
    """Given a query and a document, determines whether the document contains an answer to the
    query.

    Args:
        query (str): The query text. document (str): The document text. model_name (str): The name
        of the OpenAI API model to use for the classification.

    Returns:
        Optional[bool]: A boolean indicating whether the document contains an answer to the query
            (True meaning relevant, False meaning irrelevant), or None if the LLM produces an
            unparseable output.
    """

    from openai import OpenAI

    client = OpenAI()

    prompt = _QUERY_CONTEXT_PROMPT_TEMPLATE.format(
        query=query,
        reference=document,
    )
    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": _EVALUATION_SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
        model=model_name,
    )

    raw_response_text = str(response.choices[0].message.content).strip()
    relevance_classification = {"relevant": True, "irrelevant": False}.get(raw_response_text)
    return relevance_classification
