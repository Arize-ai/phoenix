import pandas as pd

REQUIRED_COLUMNS = ["span_id"]

# All evaluation attributes are prefixed with this to distinguish them from other attributes
EVAL_COLUMN_PREFIX = "eval."


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
