import logging
from typing import List, Optional, Set, Union

import pandas as pd

from ..models import BaseEvalModel
from ..templates import RAG_RELEVANCY_PROMPT_TEMPLATE_STR, PromptTemplate, normalize_template
from .common import NOT_PARSABLE, map_template

logger = logging.getLogger(__name__)


def llm_eval_binary(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[PromptTemplate, str],
    rails: List[str],
    system_instruction: Optional[str] = None,
) -> List[Optional[str]]:
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
        List[Optional[str]]: A list of strings representing the predicted class for each record in
        the dataframe. The list should have the same length as the input dataframe and its values
        should be the entries in the `rails` argument or None if the model's prediction could not be
        parsed.
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
    query_column_name: str = "attributes.input.value",
    retrieved_documents_column_name: str = "attributes.retrieval.documents",
) -> List[List[Optional[bool]]]:
    """Given a pandas dataframe containing queries and retrieved documents,
       classifies the relevance of each retrieved document to the corresponding
       query using an LLM.

    Args:
        dataframe (pd.DataFrame): A pandas dataframe containing queries and
        retrieved documents.

        query_column_name (str, optional): The name of the column containing the
        queries.

        retrieved_documents_column_name (str, optional): The name of the column
        containing the retrieved document data. Each entry in this column should be
        a list of dictionaries containing metadata about the retrieved documents.

    Returns:
        List[List[str]]: A list of relevant and not relevant classifications.
        The "shape" of the list should mirror the "shape" of the retrieved
        documents column, in the sense that it has the same length as the input
        dataframe and each sub-list has the same length as the corresponding
        list in the retrieved documents column. The values in the sub-lists are
        either booleans or None in the case where the LLM output could not be
        parsed.
    """

    llm_relevance_column_name = "llm_relevance"
    retrieved_document_text_column_name = "retrieved_document_text"

    non_null_query_mask = dataframe[query_column_name].notnull()
    non_empty_retrievals_mask = dataframe[retrieved_documents_column_name].apply(
        lambda x: x is not None and len(x) > 0
    )
    filtered_mask = non_null_query_mask & non_empty_retrievals_mask
    filtered_df = dataframe[filtered_mask][[query_column_name]].copy()
    filtered_df[retrieved_documents_column_name] = dataframe[filtered_mask][
        retrieved_documents_column_name
    ].map(list)

    exploded_df = filtered_df.explode(retrieved_documents_column_name, ignore_index=False)
    exploded_df[retrieved_document_text_column_name] = [
        document_data["document.content"] if document_data is not None else None
        for document_data in exploded_df[retrieved_documents_column_name]
    ]
    exploded_df = exploded_df.rename(
        columns={
            query_column_name: "query",
            retrieved_document_text_column_name: "reference",
        }
    )
    class_name_to_bool = {"relevant": True, "irrelevant": False}
    exploded_df[llm_relevance_column_name] = [
        class_name_to_bool.get(relevance_class) if relevance_class is not None else None
        for relevance_class in llm_eval_binary(
            exploded_df,
            template=template,
            model=model,
            rails=list(class_name_to_bool.keys()),
        )
    ]
    collapsed_df = exploded_df.groupby(exploded_df.index, axis="index").agg(
        {
            llm_relevance_column_name: list,
        }
    )
    output_df = pd.DataFrame(index=dataframe.index)
    output_df[llm_relevance_column_name] = None
    output_df.loc[collapsed_df.index, llm_relevance_column_name] = collapsed_df[
        llm_relevance_column_name
    ]
    return output_df[llm_relevance_column_name].tolist()


def _snap_to_rail(string: str, rails: Set[str]) -> Optional[str]:
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
    """

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
