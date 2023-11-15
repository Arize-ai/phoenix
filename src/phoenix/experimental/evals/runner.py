from typing import Any, Dict, List, Mapping, Optional, Union

from pandas import DataFrame
from tqdm.auto import tqdm
from typing_extensions import TypeGuard

from .evaluators import Evaluator, LLMEvaluator
from .models import BaseEvalModel

Record = Mapping[str, Any]
EvaluatorName = str


class EvalRunner:
    def __init__(
        self,
        evaluators: List[Union[EvaluatorName, Evaluator]],
        model: Optional[BaseEvalModel] = None,
    ) -> None:
        self._evaluators = _to_evaluators(evaluators, model)

    def evaluate_dataframe(self, dataframe: DataFrame) -> DataFrame:
        return DataFrame(
            (self._evaluate_record(row.to_dict()) for _, row in tqdm(dataframe.iterrows())),
            index=dataframe.index,
        )

    def _evaluate_record(self, record: Record) -> Dict[str, str]:
        return {
            evaluator.name: evaluator.evaluate(record).prediction for evaluator in self._evaluators
        }


def _to_evaluators(
    evaluators: List[Union[EvaluatorName, Evaluator]], model: Optional[BaseEvalModel]
) -> List[Evaluator]:
    if _is_list_of_evaluators(evaluators):
        if model is not None:
            raise ValueError(
                "When all evaluators are passed as objects, "
                "the model has already been specified for each evaluator and "
                "should not be passed as an additional argument."
            )
        return evaluators
    if model is None:
        raise ValueError("When specifying an evaluator by name, you must also pass a model.")
    return [
        LLMEvaluator.from_criteria(criteria=evaluator, model=model)
        if isinstance(evaluator, str)
        else evaluator
        for evaluator in evaluators
    ]


def _is_list_of_evaluators(
    maybe_evaluators: List[Union[EvaluatorName, Evaluator]]
) -> TypeGuard[List[Evaluator]]:
    return all(isinstance(maybe_evaluator, Evaluator) for maybe_evaluator in maybe_evaluators)
