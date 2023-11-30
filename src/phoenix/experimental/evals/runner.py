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


async def _run_eval(payload: Payload) -> Tuple[RowIndex, EvalName, EvaluationResult]:
    row_index = payload["row_index"]
    evaluator = payload["evaluator"]
    record = payload["record"]
    eval_result = await evaluator.aevaluate(record)
    return row_index, evaluator.name, eval_result


def run_evals(
    dataframe: DataFrame,
    evaluators: List[Union[EvalCriteriaName, EvalCriteria, Evaluator]],
    model: Optional[BaseEvalModel] = None,
) -> DataFrame:
    evaluators_ = _validate_and_convert_to_evaluators(evaluators, model)
    executor = AsyncExecutor(generation_fn=_run_eval)
    payloads = list(_generate_payloads(dataframe, evaluators_))
    results: DefaultDict[RowIndex, Dict[EvalName, EvalPrediction]] = defaultdict(dict)
    for row_index, eval_name, eval_result in executor.run(payloads):
        results[row_index][eval_name] = eval_result.prediction
    index, data = zip(*results.items())
    return DataFrame(data, index=index)


def _validate_and_convert_to_evaluators(
    maybe_evaluators: List[Union[EvalCriteriaName, EvalCriteria, Evaluator]],
    model: Optional[BaseEvalModel],
) -> List[Evaluator]:
    if _is_list_of_evaluators(maybe_evaluators):
        if model is not None:
            raise ValueError(
                "When all evaluators are passed as objects, "
                "the model has already been specified for each evaluator and "
                "should not be passed as an additional argument."
            )
        evaluators = maybe_evaluators
    else:
        if model is None:
            raise ValueError("When specifying an evaluator by name, you must also pass a model.")
        evaluators = [
            LLMEvaluator.from_criteria(criteria=maybe_evaluator, model=model)
            if (isinstance(maybe_evaluator, str) or isinstance(maybe_evaluator, EvalCriteria))
            else maybe_evaluator
            for maybe_evaluator in maybe_evaluators
        ]
    if len(set(evaluator.name for evaluator in evaluators)) != len(evaluators):
        raise ValueError("Evaluators must have unique names.")
    return evaluators


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
