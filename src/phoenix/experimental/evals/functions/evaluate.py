import pandas as pd

from ..evaluators import Evaluator


def llm_evaluate(
    dataframe: pd.DataFrame,
    evaluator: Evaluator,
    verbose: bool = False,
) -> None:
    for _, row in dataframe.iterrows():
        row.to_dict()
