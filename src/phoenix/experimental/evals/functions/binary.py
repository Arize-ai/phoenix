import logging
from typing import List, Optional, Set, Union

import pandas as pd

from ..models import BaseEvalModel
from ..models.openai import OpenAIModel
from ..templates import (
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    PromptTemplate,
    normalize_template,
)
from .common import map_template

logger = logging.getLogger(__name__)


def llm_eval_binary(
    dataframe: pd.DataFrame,
    template: Union[PromptTemplate, str],
    model: BaseEvalModel,
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
    responses = model.generate(prompts.to_list(), system_instruction)
    rails_set = set(rails)
    return [_snap_to_rail(response, rails_set) for response in responses]


def run_relevance_eval(
    dataframe: pd.DataFrame,
    query_column_name: str = "attributes.input.value",
    retrieved_documents_column_name: str = "attributes.retrieval.documents",
    template: str = RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    model: Optional[BaseEvalModel] = None,
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
            template=PromptTemplate(RAG_RELEVANCY_PROMPT_TEMPLATE_STR),
            model=model or OpenAIModel(),
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
    """Snaps a string to the nearest rail, or returns None if the string cannot be snapped to a
    rail.

    Args:
        string (str): An input to be snapped to a rail.

        rails (Set[str]): The target set of strings to snap to.

    Returns:
        str: A string from the rails argument or None if the input string could not be snapped.
    """

    processed_string = string.strip()
    rails_list = list(rails)
    rail = _detect_substring(processed_string, rails_list[0], rails_list[1])
    if not rail:
        logger.warning(
            f"LLM output cannot be snapped to rails {list(rails)}, returning NOT_PARSABLE. "
            f'Output: "{string}"'
        )
        return "NOT_PARSABLE"
    return rail

def _detect_substring(Z, A, B):
    """Detects if 

    Args:
        A (str): Rail value A

        B (str): Rail value B

        Z (str): Value returned by model

    Returns:
        str: A string from the rails argument or None if the input string could not be snapped.
        This handles the case where A is part of B.
        # Testing the function with the provided examples

        A = "regular", B = "irregular", Z = "irregular"
        print(detect_substring(Z, A, B))  # Output: "irregular"

        A = "regular", B = "irregular", Z = "regular"
        print(detect_substring(Z, A, B))  # Output: "regular"

        A = "regular", B = "irregular", Z = "regular,:....blah"
        print(detect_substring(Z, A, B))  # Output: "regular"

        A = "regular", B = "irregular", Z = "regular..irregular"
        print(detect_substring(Z, A, B))  # Output: None
    """
    a_pos, b_pos = Z.find(A), Z.find(B)
    
    # If both A and B are in Z
    if a_pos != -1 and b_pos != -1:
        # If either A is a prefix of B or B is a prefix of A in Z
        if a_pos < b_pos < a_pos + len(A) or b_pos < a_pos < b_pos + len(B):
            return max(A, B, key=len) # Return the longer of A or B
        else:
            return None # If A and B are distinct / both in Z, return None
    # If only A is in Z
    elif a_pos != -1:
        return A
    # If only B is in Z
    elif b_pos != -1:
        return B
    return None





