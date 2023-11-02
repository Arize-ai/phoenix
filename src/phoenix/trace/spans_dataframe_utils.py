from enum import Enum

import pandas as pd


class SpansDataframeFormats(Enum):
    """
    An enumeration of the different formats the spans dataframe can be in
    Notably, it can be beneficial to convert the dataframe to other formats
    to pipe the values into other functions like LLM Evals
    """

    key_value = "key_value"
    """
    A dataframe of root spans that captures the input and output of each trace

    Example:
    +---------+----------------+----------------+
    | span_id | input          | output         |
    +---------+----------------+----------------+
    | span_1  | why?           | because        |
    +---------+----------------+----------------+
    """


def get_root_spans(spans_df: pd.DataFrame) -> pd.DataFrame:
    """
    Returns a dataframe of root spans

    Parameters
    __________
    spans_df: pd.DataFrame
        the dataframe of spans
    """
    df = spans_df.copy()
    return df[df["parent_id"].isna()]


def to_format(spans_df: pd.DataFrame, format: SpansDataframeFormats) -> pd.DataFrame:
    """
    Returns a dataframe in a specified format for easy data manipulation.
    Inspired by OpenAI and other evaluation dataset formats.

    NB: This function is a proof of concept and is not yet fully implemented
    """
    if format == SpansDataframeFormats.key_value:
        return _to_key_value_format(spans_df)
    raise ValueError("Invalid format %s" % format)


def _to_key_value_format(spans_df: pd.DataFrame) -> pd.DataFrame:
    """
    Returns a dataframe of root spans that captures the input and output
    of each chat.

    Parameters
    __________
    spans_df: pd.DataFrame
        the dataframe of spans
    """
    root_spans = get_root_spans(spans_df)
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


def to_span_ids(spans_df: pd.DataFrame, copy: bool = True) -> pd.DataFrame:
    """
    Returns a dataframe of just span_ids
    """
    ids_df = spans_df if not copy else spans_df.copy()
    # Normalize the column name
    if "context.span_id" in ids_df.columns:
        ids_df = ids_df.rename(columns={"context.span_id": "span_id"})
    return ids_df[["span_id"]]
