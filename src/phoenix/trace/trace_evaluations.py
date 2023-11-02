from collections import OrderedDict

import pandas as pd

REQUIRED_COLUMNS = ["span_id"]

# All evaluation attributes are prefixed with this to distinguish them from other attributes
EVAL_COLUMN_PREFIX = "eval."

# Suffix added to an evaluation column to indicate it is an explanation to the evaluation
EVAL_EXPLANATION_SUFFIX = ".explanation"


def _column_needs_prefix(column: str) -> bool:
    """Returns true if the column needs to be prefixed with EVAL_COLUMN_PREFIX"""
    return column != "span_id" and not column.startswith(EVAL_COLUMN_PREFIX)


class TraceEvaluations:
    """
    A TraceEvaluations is a collection of annotations for a set of spans. The
    spans and the evaluation annotations are stored in a TraceDataset.

    The dataframe should contain the evaluation annotations for the spans in the
    TraceDataset.

    Parameters
    __________
    dataframe: pandas.DataFrame
        the pandas dataframe containing the evaluation annotations Each row
        represents the evaluations on a span.

    Example
    _______

    DataFrame of evaluations for spans:

    | span_id | eval.toxicity      | eval.relevance     |
    |---------|--------------------|--------------------|
    | span_1  | 1                  | 0                  |
    | span_2  | 0                  | 1                  |
    | span_3  | 1                  | 0                  |
    """

    dataframe: pd.DataFrame

    name: str

    def __init__(self, dataframe: pd.DataFrame):
        # Validate the the dataframe has required fields
        if missing_columns := set(REQUIRED_COLUMNS) - set(dataframe.columns):
            raise ValueError(
                f"The dataframe is missing some required columns: {', '.join(missing_columns)}"
            )
        # Add the evaluation prefix to all columns other than span_id
        dataframe.columns = pd.Index(
            [
                EVAL_COLUMN_PREFIX + column if _column_needs_prefix(column) else column
                for column in dataframe.columns
            ]
        )
        self.dataframe = dataframe


def binary_classifications_to_evaluations(
    classifications_df: pd.DataFrame,
    spans_df: pd.DataFrame,
    rails: OrderedDict[str, bool],
    evaluation_name: str,
) -> pd.DataFrame:
    """
    Returns a dataframe of evaluations from a dataframe of binary classifications

    Parameters
    __________
    classifications_df: pd.DataFrame
        the dataframe of binary classifications, typically the output of llm evals
    """
    evaluations_df = classifications_df.copy()

    # Use the binary evaluations to convert the binary classifications to 1 or 0
    # Convert the labels to a 0 or 1 depending on if the span is toxic or not
    evaluations_df["label"] = evaluations_df["label"].apply(
        lambda classification: 1 if rails[classification] else 0
    )

    # Re-name the columns to match a consistent format
    evaluations_df = evaluations_df.rename(
        columns={
            "label": EVAL_COLUMN_PREFIX + evaluation_name,
            "explanation": EVAL_COLUMN_PREFIX + evaluation_name + EVAL_EXPLANATION_SUFFIX,
        }
    )
