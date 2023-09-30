import logging
from typing import Any, Iterable, List, Optional, Set, Union, cast

import pandas as pd

from phoenix.trace.semantic_conventions import DOCUMENT_CONTENT, INPUT_VALUE, RETRIEVAL_DOCUMENTS

from ..models import BaseEvalModel
from ..templates import (
    NOT_PARSABLE,
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    PromptTemplate,
    map_template,
    normalize_template,
)

logger = logging.getLogger(__name__)


OPENINFERENCE_QUERY_COLUMN_NAME = "attributes." + INPUT_VALUE
OPENINFERENCE_DOCUMENT_COLUMN_NAME = "attributes." + RETRIEVAL_DOCUMENTS


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
        be the entries in the rails argument or "NOT_PARSABLE" if the model's prediction could not
        be parsed.
    """

    eval_template = normalize_template(template)
    prompts = map_template(dataframe, eval_template)
    responses = model.generate(prompts.to_list(), instruction=system_instruction)
    rails_set = set(rails)
    return [_snap_to_rail(response, rails_set) for response in responses]


def run_relevance_eval(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[PromptTemplate, str] = RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    rails: List[str] = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
    system_instruction: Optional[str] = None,
    query_column_name: str = "query",
    document_column_name: str = "reference",
) -> List[List[str]]:
    """
    Given a pandas dataframe containing queries and retrieved documents, classifies the relevance of
    each retrieved document to the corresponding query using an LLM.

    Args:
        dataframe (pd.DataFrame): A pandas dataframe containing queries and retrieved documents. If
        both query_column_name and reference_column_name are present in the input dataframe, those
        columns are used as inputs and should appear in the following format:

        - The entries of the query column must be strings.
        - The entries of the documents column must be lists of strings. Each list may contain an
          arbitrary number of document texts retrieved for the corresponding query.

        If the input dataframe is lacking either query_column_name or reference_column_name but has
        query and retrieved document columns in OpenInference trace format named
        "attributes.input.value" and "attributes.retrieval.documents", respectively, then those
        columns are used as inputs and should appear in the following format:

        - The entries of the query column must be strings.
        - The entries of the document column must be lists of OpenInference document objects, each
          object being a dictionary that stores the document text under the key "document.content".

        This latter format is intended for running evaluations on exported OpenInference trace
        dataframes. For more information on the OpenInference tracing specification, see
        https://github.com/Arize-ai/open-inference-spec/.

        model (BaseEvalModel): The model used for evaluation.

        template (Union[PromptTemplate, str], optional): The template used for evaluation.

        rails (List[str], optional): A list of strings representing the possible output classes of
        the model's predictions.

        query_column_name (str, optional): The name of the query column in the dataframe, which
        should also be a template variable.

        reference_column_name (str, optional): The name of the document column in the dataframe,
        which should also be a template variable.

        system_instruction (Optional[str], optional): An optional system message.

    Returns:
        List[List[str]]: A list of relevant and not relevant classifications. The "shape" of the
        list should mirror the "shape" of the retrieved documents column, in the sense that it has
        the same length as the input dataframe and each sub-list has the same length as the
        corresponding list in the retrieved documents column. The values in the sub-lists are either
        entries from the rails argument or "NOT_PARSABLE" in the case where the LLM output could not
        be parsed.
    """

    query_column = dataframe.get(query_column_name)
    document_column = dataframe.get(document_column_name)
    if query_column is None or document_column is None:
        openinference_query_column = dataframe.get(OPENINFERENCE_QUERY_COLUMN_NAME)
        openinference_document_column = dataframe.get(OPENINFERENCE_DOCUMENT_COLUMN_NAME)
        if openinference_query_column is None or openinference_document_column is None:
            raise ValueError(
                f'Dataframe columns must include either "{query_column_name}" and '
                f'"{document_column_name}", or "{OPENINFERENCE_QUERY_COLUMN_NAME}" and '
                f'"{OPENINFERENCE_DOCUMENT_COLUMN_NAME}".'
            )
        query_column = openinference_query_column
        document_column = openinference_document_column.map(
            lambda docs: _get_contents_from_openinference_documents(docs)
            if docs is not None
            else None
        )

    queries = cast("pd.Series[str]", query_column).tolist()
    document_lists = cast("pd.Series[str]", document_column).tolist()
    indexes = []
    expanded_queries = []
    expanded_documents = []
    for index, (query, documents) in enumerate(zip(queries, document_lists)):
        if query is None or documents is None:
            continue
        for document in documents:
            indexes.append(index)
            expanded_queries.append(query)
            expanded_documents.append(document)
    predictions = llm_eval_binary(
        dataframe=pd.DataFrame(
            {
                query_column_name: expanded_queries,
                document_column_name: expanded_documents,
            }
        ),
        model=model,
        template=template,
        rails=rails,
        system_instruction=system_instruction,
    )
    outputs: List[List[str]] = [[] for _ in range(len(dataframe))]
    for index, prediction in zip(indexes, predictions):
        outputs[index].append(prediction)
    return outputs


def _get_contents_from_openinference_documents(documents: Iterable[Any]) -> List[Optional[str]]:
    """
    Get document contents from an iterable of OpenInference document objects, which are dictionaries
    containing the document text under the "document.content" key.
    """
    return [doc.get(DOCUMENT_CONTENT) if isinstance(doc, dict) else None for doc in documents]


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
