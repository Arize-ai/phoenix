from typing import Any, Dict, List, Mapping

from pandas import DataFrame
from tqdm.auto import tqdm

from .evaluators import Evaluator

Record = Mapping[str, Any]


class EvalRunner:
    def __init__(
        self,
        evaluators: List[Evaluator],
    ) -> None:
        self._evaluators = evaluators

    def evaluate_dataframe(self, dataframe: DataFrame) -> DataFrame:
        return DataFrame(
            self._evaluate_record(row.to_dict()) for _, row in tqdm(dataframe.iterrows())
        )

    def _evaluate_record(self, record: Record) -> Dict[str, str]:
        return {
            evaluator.name: evaluator.evaluate(record).prediction for evaluator in self._evaluators
        }
