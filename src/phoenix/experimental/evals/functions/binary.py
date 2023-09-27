import logging
from typing import Dict, List, Optional, Set, Union

import pandas as pd

from phoenix.trace.semantic_conventions import INPUT_VALUE, RETRIEVAL_DOCUMENTS

from ..models import BaseEvalModel
from ..templates import (
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    PromptTemplate,
    normalize_template,
)
from .common import NOT_PARSABLE, map_template

logger = logging.getLogger(__name__)


OPENINFERENCE_QUERY_COLUMN_NAME = "attributes." + INPUT_VALUE
OPENINFERENCE_DOCUMENT_COLUMN_NAME = "attributes." + RETRIEVAL_DOCUMENTS
DocumentObject = Dict[str, str]


def llm_eval_binary(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[PromptTemplate, str],
    rails: List[str],
    system_instruction: Optional[str] = None,
) -> List[str]:
    """Runs binary classifications using an LLM.

    Args:
        dataframe (pandas.DataFrame): A pandas dataframe in which each row represents a record to be
        classified. All template variable names must appear as column names in the dataframe (extra
        columns unrelated to the template are permitted).

        template (Union[PromptTemplate, str]): The prompt template as either an instance of
        PromptTemplate or a string. If the latter, the variable names should be surrounded by
        curly braces so that a call to `.format` can be made to substitute variable values.

        model (BaseEvalModel): An LLM model class.

        rails (List[str]): A list of strings representing the possible output classes of the model's
        predictions.

        system_instruction (Optional[str], optional): An optional system message.

    Returns:
        List[str]: A list of strings representing the predicted class for each record in the
        dataframe. The list should have the same length as the input dataframe and its values should
        be the entries in the `rails` argument or None if the model's prediction could not be
        parsed.
    """

    eval_template = normalize_template(template)
    prompts = map_template(dataframe, eval_template)
    responses = model.generate(prompts.to_list(), instruction=system_instruction)
    rails_set = set(rails)
    return [_snap_to_rail(response, rails_set) for response in responses]


"""

Args:
    dataframe (pd.DataFrame):

    rails_map: The mapping to use to return the values. Using a dict here
    but it can take the OrderedDict of RAILS_MAP from library

Returns:
    List[List[str]]:
"""


def run_relevance_eval(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[PromptTemplate, str] = RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    rails: List[str] = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
    query_column_name: str = OPENINFERENCE_QUERY_COLUMN_NAME,
    document_column_name: str = OPENINFERENCE_DOCUMENT_COLUMN_NAME,
    query_template_variable: str = "query",
    document_template_variable: str = "reference",
) -> List[List[str]]:
    """
    Given a pandas dataframe containing queries and retrieved documents,
    classifies the relevance of each retrieved document to the corresponding
    query using an LLM.

    Args:
        dataframe (pd.DataFrame): A pandas dataframe containing queries and retrieved documents.

        model (BaseEvalModel): The model used for evaluation.

        template (Union[PromptTemplate, str], optional): The template used for evaluation.

        rails (List[str], optional): A list of strings representing the possible output classes of
        the model's predictions.

        query_column_name (str, optional): The name of the column containing the queries.

        document_column_name (str, optional): The name of the column containing the retrieved.

        query_template_variable (str, optional): The name of the query template variable.

        reference_template_variable (str, optional): The name of the document template variable.

    Returns:
        List[List[str]]: A list of relevant and not relevant classifications. The "shape" of the
        list should mirror the "shape" of the retrieved documents column, in the sense that it has
        the same length as the input dataframe and each sub-list has the same length as the
        corresponding list in the retrieved documents column. The values in the sub-lists are either
        entries from the rails argument or "NOT_PARSABLE" in the case where the LLM output could not
        be parsed.
    """
    queries = dataframe[query_column_name].tolist()
    document_lists = (
        dataframe[document_column_name]
        .map(
            lambda documents: None
            if documents is None
            else _get_contents(documents, key="document.content")
        )
        .tolist()
    )
    query_indexes = []
    query_document_pairs = []
    outputs: List[List[str]] = [[] for _ in range(len(dataframe))]
    for query_index, (query, documents) in enumerate(zip(queries, document_lists)):
        if query is None or documents is None:
            continue
        for document in documents:
            query_indexes.append(query_index)
            query_document_pairs.append((query, document))
    predictions = llm_eval_binary(
        dataframe=pd.DataFrame(
            {
                query_template_variable: [query for query, _ in query_document_pairs],
                document_template_variable: [document for _, document in query_document_pairs],
            }
        ),
        model=model,
        template=template,
        rails=rails,
    )
    for query_index, prediction in zip(query_indexes, predictions):
        outputs[query_index].append(prediction)
    return outputs


def _get_contents(documents: List[Union[str, DocumentObject]], key: str) -> List[Optional[str]]:
    """Gets the contents from documents.

    Args:
        documents (Iterable[Union[str, Dict[str, str]]]): The input documents.

        key (str): A key to access the document contents in case the document in question is a
        dictionary.

    Returns:
        List[Optional[str]]: The list of document contents as strings or None if the input document
        could not be parsed.
    """
    return [doc if isinstance(doc, str) else doc.get(key) for doc in documents]


def _snap_to_rail(string: str, rails: Set[str]) -> str:
    """
    Snaps a string to the nearest rail, or returns None if the string cannot be snapped to a
    rail.

    Args:
        string (str): An input to be snapped to a rail.

        rails (Set[str]): The target set of strings to snap to.

    Returns:
        str: A string from the rails argument or None if the input string could not be snapped.
    """

    processed_string = string.strip()
    rails_list = list(rails)
    rail = _extract_rail(processed_string, rails_list[0], rails_list[1])
    if not rail:
        logger.warning(
            f"LLM output cannot be snapped to rails {list(rails)}, returning {NOT_PARSABLE}. "
            f'Output: "{string}"'
        )
        return NOT_PARSABLE
    return rail


def _extract_rail(string: str, positive_rail: str, negative_rail: str) -> Optional[str]:
    """
    Extracts the right rails text from the llm output. If the rails have overlapping characters,
    (e.x. "regular" and "irregular"), it also ensures that the correct rail is returned.

    Args:
        string (str): An input to be snapped to a rail.

        positive_rail (str): The positive rail (e.x. toxic)

        negative_rail (str): The negative rail. (e.x. non-toxic)

    Returns:
        str: A string from the rails or None if the input string could not be extracted.

    Examples:
        given: positive_rail = "irregular", negative_rail = "regular"

        string = "irregular"
        Output: "irregular"

        string = "regular"
        Output: "regular"

        string = "regular,:....random"
        Output: "regular"

        string = "regular..irregular" - contains both rails
        Output: None

        string = "Irregular"
        Output: "irregular"
    """

    # Convert the inputs to lowercase for case-insensitive matching
    string = string.lower()
    positive_rail = positive_rail.lower()
    negative_rail = negative_rail.lower()

    positive_pos, negative_pos = string.find(positive_rail), string.find(negative_rail)

    # If both positive and negative rails are in the string
    if positive_pos != -1 and negative_pos != -1:
        # If either one is a substring of the other, return the longer one
        # e.x. "regular" and "irregular"
        if positive_pos < negative_pos < positive_pos + len(
            positive_rail
        ) or negative_pos < positive_pos < negative_pos + len(negative_rail):
            # Return the longer of the rails since it means the LLM returned the longer one
            return max(positive_rail, negative_rail, key=len)
        else:
            # If both rails values are in the string, we cannot determine which to return
            return None
    # If only positive is in string
    elif positive_pos != -1:
        return positive_rail
    # If only negative is in the string
    elif negative_pos != -1:
        return negative_rail
    return None
