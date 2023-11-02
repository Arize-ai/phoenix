from collections import OrderedDict

import pandas as pd

from .spans_dataframe_utils import to_span_ids

REQUIRED_COLUMNS = ["span_id", "value"]

EVAL_NAME_COLUMN_PREFIX = "eval."


class TraceEvalDataset:
    """
    A TraceEvalDataset is a set evaluation annotations for a set of spans.
    TraceEvalDataset encompasses the evaluation annotations for a single eval
    such as toxicity or relevance.

    TraceEvalDatasets can be appended to TraceDatasets so that the spans and
    evaluations can be joined and analyzed together.

    Parameters
    __________
    eval_name: str
        the name of the evaluation, e.x. 'toxicity'
    dataframe: pandas.DataFrame
        the pandas dataframe containing the evaluation annotations Each row
        represents the evaluations on a span.

    Example
    _______

    DataFrame of evaluations for toxicity may look like:

    | span_id | value              | label              | explanation        |
    |---------|--------------------|--------------------|--------------------|
    | span_1  | 1                  | toxic              | bad language       |
    | span_2  | 0                  | non-toxic          | violence           |
    | span_3  | 1                  | toxic              | discrimination     |
    """

    dataframe: pd.DataFrame

    eval_name: str  # The name for the evaluation, e.x. 'toxicity'

    def __init__(self, eval_name: str, dataframe: pd.DataFrame):
        self.eval_name = eval_name
        # Validate the the dataframe has required fields
        if missing_columns := set(REQUIRED_COLUMNS) - set(dataframe.columns):
            raise ValueError(
                f"The dataframe is missing some required columns: {', '.join(missing_columns)}"
            )
        self.dataframe = dataframe

    def get_eval_dataframe(self, prefix_columns_with_name: bool = True) -> pd.DataFrame:
        """
        Returns a copy of the dataframe with the evaluation annotations

        Parameters
        __________
        prefix_columns_with_name: bool
            if True, the columns will be prefixed with the eval_name, e.x. 'eval.toxicity.value'
        """
        dataframe = self.dataframe.copy()
        if prefix_columns_with_name:
            # Prefix all columns except the span_id column
            columns_to_prefix = [column for column in dataframe.columns if column != "span_id"]
            dataframe.rename(
                columns={
                    column: f"{EVAL_NAME_COLUMN_PREFIX}{self.eval_name}.{column}"
                    for column in columns_to_prefix
                },
                inplace=True,
            )
        return dataframe


def binary_classifications_to_trace_eval_dataset(
    eval_name: str,
    classifications_df: pd.DataFrame,
    spans_df: pd.DataFrame,
    rails_map: OrderedDict[bool, str],
) -> TraceEvalDataset:
    """
    Takes a dataframe of binary classifications and converts it to a TraceEvalDataset

    Parameters
    __________
    eval_name: str
        the name of the evaluation, e.x. 'toxicity'
    classifications_df: pd.DataFrame
        the dataframe of binary classifications, typically the output of llm evals
    spans_df: pd.DataFrame
        the dataframe of spans over which the classifications were made
    rails_map: OrderedDict[str, bool]
        a map of the binary classifications to the labels. E.x. {True: "toxic", False: "non-toxic"}
    """
    evaluations_df = classifications_df.copy()
    span_ids_df = to_span_ids(spans_df, copy=True)

    # Remove all the spans_df columns that are not needed
    columns_to_drop = [column for column in spans_df.columns if (column != "span_id")]
    spans_df.drop(columns_to_drop, axis=1, inplace=True)

    # Convert the rails map to a map of labels to binary values
    classification_map = {label: binary for binary, label in rails_map.items()}
    # Use the evaluations to convert the binary classifications to a 1 or 0 value
    evaluations_df["value"] = evaluations_df["label"].apply(
        lambda classification: 1 if classification_map[classification] else 0
    )

    # Join the spans dataframe to the evaluations dataframe
    evaluations_df = pd.DataFrame.join(span_ids_df, evaluations_df)
    return TraceEvalDataset(eval_name, evaluations_df)
