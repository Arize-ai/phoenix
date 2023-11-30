from collections import defaultdict
from typing import (
    Any,
    DefaultDict,
    Dict,
    Generator,
    Iterable,
    List,
    Mapping,
    Tuple,
    TypedDict,
)

from pandas import DataFrame
from typing_extensions import TypeAlias

from .evaluators import EvaluationResult, Evaluator
from .functions.classify import AsyncExecutor

RowIndex: TypeAlias = Any
EvalName: TypeAlias = str
Record: TypeAlias = Mapping[str, Any]
EvalPrediction: TypeAlias = str


class Payload(TypedDict):
    row_index: RowIndex
    evaluator: Evaluator
    record: Record


def run_evals(
    dataframe: DataFrame,
    evaluators: List[Evaluator],
) -> DataFrame:
    if len(set(evaluator.name for evaluator in evaluators)) != len(evaluators):
        raise ValueError("Evaluators must have unique names.")
    executor = AsyncExecutor(generation_fn=_run_eval)
    payloads = list(_generate_payloads(dataframe, evaluators))
    results: DefaultDict[RowIndex, Dict[EvalName, EvalPrediction]] = defaultdict(dict)
    for row_index, eval_name, eval_result in executor.run(payloads):
        results[row_index][eval_name] = eval_result.prediction
    index, data = zip(*results.items())
    return DataFrame(data, index=index)


async def _run_eval(payload: Payload) -> Tuple[RowIndex, EvalName, EvaluationResult]:
    row_index = payload["row_index"]
    evaluator = payload["evaluator"]
    record = payload["record"]
    eval_result = await evaluator.aevaluate(record)
    return row_index, evaluator.name, eval_result


def _generate_payloads(
    dataframe: DataFrame, evaluators: Iterable[Evaluator]
) -> Generator[Payload, None, None]:
    for row_index, row in dataframe.iterrows():
        for evaluator in evaluators:
            yield {
                "row_index": row_index,
                "evaluator": evaluator,
                "record": row.to_dict(),
            }
