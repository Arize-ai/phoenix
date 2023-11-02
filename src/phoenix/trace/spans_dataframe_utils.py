from enum import Enum

import pandas as pd


class SpansDataframeFormats(Enum):
    """
    An enumeration of the different formats the spans dataframe can be in
    Notably, it can be beneficial to convert the dataframe to other formats
    to pipe the values into other functions like LLM Evals
    """

    key_value = "key_value"


def get_root_spans(spans_df: pd.DataFrame, copy: bool = True) -> pd.DataFrame:
    """
    Returns a dataframe of root spans

    Parameters
    __________
    spans_df: pd.DataFrame
        the dataframe of spans
    copy: bool
        if True, a copy of the dataframe is returned. Otherwise, the original dataframe is returned
    """
    if copy:
        spans_df = spans_df.copy()
    return spans_df[spans_df["parent_id"].isna()]


def to_format(spans_df: pd.DataFrame, format: SpansDataframeFormats) -> pd.DataFrame:
    """
    Returns a dataframe in a specified format for easy data manipulation
    """
    if format == SpansDataframeFormats.key_value:
        return to_key_value_format(spans_df)
    raise ValueError("Invalid format %s" % format)


def to_key_value_format(spans_df: pd.DataFrame, copy: bool = True) -> pd.DataFrame:
    """
    Returns a dataframe of root spans that captures the input and output
    of each chat.

    Parameters
    __________
    spans_df: pd.DataFrame
        the dataframe of spans
    copy: bool
        if True, a copy of the dataframe is returned. Otherwise, the original dataframe is modified
    """
    root_spans = get_root_spans(spans_df, copy=copy)
    root_spans = root_spans[
        ["context.span_id", "attributes.input.value", "attributes.output.value"]
    ]
    root_spans = root_spans.rename(
        columns={
            "context.span_id": "span_id",
            "attributes.input.value": "input",
            "attributes.output.value": "output",
        }
    )
    return root_spans


def join_spans_and_evaluations(
    spans_df: pd.DataFrame, evaluations_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Returns a dataframe of spans joined with their corresponding evaluations

    Parameters
    __________
    spans_df: pd.DataFrame
        the dataframe of spans
    evaluations_df: pd.DataFrame
        the dataframe of evaluations
    """
    spans_df = spans_df.copy()
    evaluations_df = evaluations_df.copy()

    # Rename the columns to match and be joinable
    if "context.span_id" in spans_df.columns:
        spans_df = spans_df.rename(columns={"context.span_id": "span_id"})
    spans_df = spans_df.set_index("span_id")
    spans_with_evaluations_df = spans_df.join(evaluations_df)
    # Drop all the columns that are not needed
    columns_to_drop = [column for column in spans_df.columns if column != "span_id"]
    spans_with_evaluations_df.drop(columns_to_drop, axis=1, inplace=True)
    return spans_with_evaluations_df
