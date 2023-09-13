from typing import List, Optional

import pandas as pd

from ..models import BaseEvalModel
from ..models.openai import OpenAiModel
from ..templates import (
    RELEVANCY_PROMPT_TEMPLATE,
    PromptTemplate,
)


def llm_eval_binary(
    dataframe: pd.DataFrame,
    template: PromptTemplate,
    model: BaseEvalModel,
    system_instruction: Optional[str] = None,
) -> List[Optional[str]]:
    """Runs binary classifications using an LLM.

    Args:
        df (pandas.DataFrame): A pandas dataframe in which each row represents a record to be
        classified. All template variable names must appear as column names in the dataframe (extra
        columns unrelated to the template are permitted).

        template (Union[PromptTemplate, str]): The prompt template as either an instance of
        PromptTemplate or a Python string. If the latter, the variable names should be surrounded by
        curly braces so that a call to `.format` can be made to substitute variable values.

        model (BaseEvalModel): An LLM model class.

        system_instruction (Optional[str], optional): An optional system message.

    Returns:
        List[Optional[str]]: A list of strings representing the predicted class for each record in
        the dataframe. The list should have the same length as the input dataframe and its values
        should be the entries in the `rails` argument or None if the model's prediction could not be
        parsed.
    """

    # I was considering to construct the prompts and generate answers concurrently. However,
    # if there's errors in the prompt construction it could interrupt the process and we
    # would've used API credits for nothing. We could solve this problem by streaming the
    # answers so that, if there is an error, we keep the answers obtained up to that point.
    # These are out of scope for M0, but good to keep in mind and consider for the future.
    try:
        prompts = dataframe.apply(
            lambda row: template.format(
                variable_values={var_name: row[var_name] for var_name in template.variables}
            ),
            axis=1,
        )
    except KeyError as e:
        raise RuntimeError(
            f"Error while constructing the prompts from the template and dataframe. "
            f"The template variable {e} is not found as a column in the dataframe."
        )
    except Exception as e:
        raise RuntimeError(
            f"Error while constructing the prompts from the template and dataframe variables: {e}."
        )

    responses = model.generate(prompts.to_list(), system_instruction)
    rail_classes = set(template.rails)
    return [
        (rail_class if (rail_class := resp.strip()) in rail_classes else None) for resp in responses
    ]


def run_relevance_eval(
    dataframe: pd.DataFrame,
    query_column_name: str = "attributes.input.value",
    retrieved_documents_column_name: str = "attributes.retrieval.documents",
    template: PromptTemplate = RELEVANCY_PROMPT_TEMPLATE,
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
            template=template,
            model=model or OpenAiModel(),
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
