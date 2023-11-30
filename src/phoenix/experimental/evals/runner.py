from collections import defaultdict
from typing import (
    Any,
    DefaultDict,
    Dict,
    Generator,
    Iterable,
    List,
    Mapping,
    Optional,
    Tuple,
    TypedDict,
    Union,
)

from pandas import DataFrame
from typing_extensions import TypeAlias, TypeGuard

from .evaluators import EvalCriteria, EvaluationResult, Evaluator, LLMEvaluator
from .functions.classify import AsyncExecutor
from .models import BaseEvalModel

RowIndex: TypeAlias = Any
EvalName: TypeAlias = str
Record: TypeAlias = Mapping[str, Any]
EvalCriteriaName: TypeAlias = str
EvalPrediction: TypeAlias = str


class Payload(TypedDict):
    row_index: RowIndex
    evaluator: Evaluator
    record: Record


class EvalRunner:
    def __init__(
        self,
        evaluators: List[Union[EvalCriteriaName, EvalCriteria, Evaluator]],
        model: Optional[BaseEvalModel] = None,
    ) -> None:
        self._evaluators = _validate_and_convert_to_evaluators(evaluators, model)

        async def run_eval(payload: Payload) -> Tuple[RowIndex, EvalName, EvaluationResult]:
            row_index = payload["row_index"]
            evaluator = payload["evaluator"]
            record = payload["record"]
            eval_result = await evaluator.aevaluate(record)
            return row_index, evaluator.name, eval_result

        self._executor = AsyncExecutor(generation_fn=run_eval)

    def evaluate_dataframe(self, dataframe: DataFrame) -> DataFrame:
        payloads = list(_generate_payloads(dataframe, self._evaluators))
        results: DefaultDict[RowIndex, Dict[EvalName, EvalPrediction]] = defaultdict(dict)
        for row_index, eval_name, eval_result in self._executor.run(payloads):
            results[row_index][eval_name] = eval_result.prediction
        index, data = zip(*results.items())
        return DataFrame(data, index=index)


def _validate_and_convert_to_evaluators(
    evaluators: List[Union[EvalCriteriaName, EvalCriteria, Evaluator]],
    model: Optional[BaseEvalModel],
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
        if (isinstance(evaluator, str) or isinstance(evaluator, EvalCriteria))
        else evaluator
        for evaluator in evaluators
    ]


def _is_list_of_evaluators(
    maybe_evaluators: List[Union[EvalCriteriaName, EvalCriteria, Evaluator]]
) -> TypeGuard[List[Evaluator]]:
    return all(isinstance(maybe_evaluator, Evaluator) for maybe_evaluator in maybe_evaluators)


def _generate_payloads(
    dataframe: DataFrame, evaluators: Iterable[Evaluator]
) -> Generator[Payload, None, None]:
    for row_index, row in dataframe.iterrows():
        for evaluator in evaluators:
            yield {"row_index": row_index, "evaluator": evaluator, "record": row.to_dict()}
