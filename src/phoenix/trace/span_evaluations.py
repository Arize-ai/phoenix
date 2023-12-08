import pandas as pd

EVALUATIONS_INDEX_NAME = "context.span_id"
RESULTS_COLUMN_NAMES = ["score", "label", "explanation"]

EVAL_NAME_COLUMN_PREFIX = "eval."


class SpanEvaluations:
    """
    SpanEvaluations is a set of evaluation annotations for a set of spans.
    SpanEvaluations encompasses the evaluation annotations for a single evaluation task
    such as toxicity or hallucinations.

    SpanEvaluations can be appended to TraceDatasets so that the spans and
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

    | span_id | score              | label              | explanation        |
    |---------|--------------------|--------------------|--------------------|
    | span_1  | 1                  | toxic              | bad language       |
    | span_2  | 0                  | non-toxic          | violence           |
    | span_3  | 1                  | toxic              | discrimination     |
    """

    dataframe: pd.DataFrame

    eval_name: str  # The name for the evaluation, e.x. 'toxicity'

    def __init__(self, eval_name: str, dataframe: pd.DataFrame):
        self.eval_name = eval_name

        # If the dataframe contains the index column, set the index to that column
        if EVALUATIONS_INDEX_NAME in dataframe.columns:
            dataframe = dataframe.set_index(EVALUATIONS_INDEX_NAME)

        # validate that the dataframe is indexed by context.span_id
        if dataframe.index.name != EVALUATIONS_INDEX_NAME:
            raise ValueError(
                f"The dataframe index must be '{EVALUATIONS_INDEX_NAME}' but was "
                f"'{dataframe.index.name}'"
            )

        # Drop the unnecessary columns
        extra_column_names = dataframe.columns.difference(RESULTS_COLUMN_NAMES)
        self.dataframe = dataframe.drop(extra_column_names, axis=1)

    def get_dataframe(self, prefix_columns_with_name: bool = True) -> pd.DataFrame:
        """
        Returns a copy of the dataframe with the evaluation annotations

        Parameters
        __________
        prefix_columns_with_name: bool
            if True, the columns will be prefixed with the eval_name, e.x. 'eval.toxicity.value'
        """
        if prefix_columns_with_name:
            prefix = f"{EVAL_NAME_COLUMN_PREFIX}{self.eval_name}."
            return self.dataframe.add_prefix(prefix)
        return self.dataframe.copy()
