import functools
import inspect
from typing import Any, Callable

from typing_extensions import TypeAlias

from phoenix.datasets.types import (
    AnnotatorKind,
    CanAsyncEvaluate,
    CanEvaluate,
    EvaluationResult,
    Example,
    ExperimentEvaluator,
    ExperimentRun,
    JSONSerializable,
    ScoreType,
)

EvalCallable: TypeAlias = Callable[..., Any]


def _unwrap_json(obj: JSONSerializable) -> JSONSerializable:
    if isinstance(obj, dict):
        if len(obj) == 1:
            key = next(iter(obj.keys()))
            output = obj[key]
            assert isinstance(
                output, (dict, list, str, int, float, bool, type(None))
            ), "Output must be JSON serializable"
            return output
    return obj


def _bind_signature(
    sig: inspect.Signature, example: Example, experiment_run: ExperimentRun
) -> inspect.BoundArguments:
    params = sig.parameters
    if len(params) == 1:
        if "example" in params:
            return sig.bind_partial(example=example)
        elif "experiment_run" in params:
            return sig.bind_partial(experiment_run=experiment_run)
        else:
            return sig.bind(experiment_run.output.result)
    elif len(params) == 2:
        if "example" in params and "experiment_run" in params:
            return sig.bind_partial(example=example, experiment_run=experiment_run)
        else:
            raise ValueError(
                (
                    "Evaluation signature has two parameters, but they are not 'example' "
                    "and 'experiment_run'."
                )
            )
    else:
        raise ValueError(
            (
                f"Evaluation signature has {len(params)} parameters, but only 1 or 2 parameters "
                "are supported."
            )
        )


def evaluator(
    name: str, annotator_kind: AnnotatorKind, score_type: ScoreType = ScoreType.BOOLEAN
) -> Callable[[EvalCallable], ExperimentEvaluator]:
    if score_type == ScoreType.BOOLEAN:
        result_processor = _process_boolean_eval
    elif score_type == ScoreType.FLOAT:
        result_processor = _process_float_eval
    else:
        raise ValueError(f"Unsupported score type: {score_type}")

    def wrapper(func: EvalCallable) -> ExperimentEvaluator:
        wrapped_signature = inspect.signature(func)

        if inspect.iscoroutinefunction(func):
            return _wrap_coroutine_evaluation_function(
                name, annotator_kind, wrapped_signature, result_processor
            )(func)
        else:
            return _wrap_sync_evaluation_function(
                name, annotator_kind, wrapped_signature, result_processor
            )(func)

    return wrapper


def _wrap_coroutine_evaluation_function(
    name: str,
    annotator_kind: AnnotatorKind,
    sig: inspect.Signature,
    convert_to_score: Callable[[Any], EvaluationResult],
) -> Callable[[EvalCallable], CanAsyncEvaluate]:
    def wrapper(func: EvalCallable) -> CanAsyncEvaluate:
        class AsyncEvaluator:
            def __init__(self) -> None:
                self.name = name
                self.annotator_kind = annotator_kind

            @functools.wraps(func)
            async def __call__(self, *args: Any, **kwargs: Any) -> Any:
                return await func(*args, **kwargs)

            async def async_evaluate(
                self, example: Example, experiment_run: ExperimentRun
            ) -> EvaluationResult:
                bound_signature = _bind_signature(sig, example, experiment_run)
                result = await func(*bound_signature.args, **bound_signature.kwargs)
                return convert_to_score(result)

        evaluator = AsyncEvaluator()
        assert isinstance(evaluator, CanAsyncEvaluate)
        return evaluator

    return wrapper


def _wrap_sync_evaluation_function(
    name: str,
    annotator_kind: AnnotatorKind,
    sig: inspect.Signature,
    convert_to_score: Callable[[Any], EvaluationResult],
) -> Callable[[EvalCallable], CanEvaluate]:
    def wrapper(func: EvalCallable) -> CanEvaluate:
        class SyncEvaluator:
            def __init__(self) -> None:
                self.name = name
                self.annotator_kind = annotator_kind

            @functools.wraps(func)
            def __call__(self, *args: Any, **kwargs: Any) -> Any:
                return func(*args, **kwargs)

            def evaluate(self, example: Example, experiment_run: ExperimentRun) -> EvaluationResult:
                bound_signature = _bind_signature(sig, example, experiment_run)
                result = func(*bound_signature.args, **bound_signature.kwargs)
                return convert_to_score(result)

        evaluator = SyncEvaluator()
        assert isinstance(evaluator, CanEvaluate)
        return evaluator

    return wrapper


def _process_float_eval(result: Any) -> EvaluationResult:
    result = float(result)
    bound_result = max(0.0, min(1.0, result))
    return EvaluationResult(score=bound_result)


def _process_boolean_eval(result: Any) -> EvaluationResult:
    result = bool(result)
    return EvaluationResult(score=float(result))
