import functools
import inspect
from typing import Any, Callable, Optional

from phoenix.datasets.types import (
    AnnotatorKind,
    CanAsyncEvaluate,
    CanEvaluate,
    EvaluationResult,
    EvaluatorCallable,
    Example,
    ExperimentEvaluator,
    ExperimentRun,
    JSONSerializable,
)


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


def _validate_signature(sig: inspect.Signature) -> None:
    # Check that the wrapped function has a valid signature for use as an evaluator
    # If it does not, raise an error to exit early before running evaluations
    params = sig.parameters
    valid_named_params = {"input", "output", "reference", "metadata"}
    if len(params) == 0:
        raise ValueError("Evaluation function must have at least one parameter.")
    if len(params) > 1:
        not_found = set(params) - valid_named_params
        if not_found:
            raise ValueError(
                (
                    f"Invalid parameter names in evaluation function: {', '.join(not_found)}. "
                    f"Parameters names must be any of: {', '.join(valid_named_params)}."
                )
            )


def _bind_signature(
    sig: inspect.Signature, example: Example, experiment_run: ExperimentRun
) -> inspect.BoundArguments:
    if experiment_run.output:
        output = experiment_run.output.result
    else:
        output = None
    parameter_mapping = {
        "input": example.input,
        "output": output,
        "reference": example.output,
        "metadata": example.metadata,
    }
    params = sig.parameters
    if len(params) == 1:
        parameter_name = next(iter(params))
        if parameter_name in parameter_mapping:
            return sig.bind(parameter_mapping[parameter_name])
        else:
            return sig.bind(parameter_mapping["output"])
    else:
        return sig.bind_partial(**{name: parameter_mapping[name] for name in params})


def create_evaluator(
    annotator: AnnotatorKind = AnnotatorKind.CODE,
    name: Optional[str] = None,
    scorer: Optional[Callable[[Any], EvaluationResult]] = None,
) -> Callable[[EvaluatorCallable], ExperimentEvaluator]:
    if scorer is None:
        scorer = _default_eval_scorer

    def wrapper(func: EvaluatorCallable, name: Optional[str] = name) -> ExperimentEvaluator:
        if name is None:
            name = func.__name__

        wrapped_signature = inspect.signature(func)
        _validate_signature(wrapped_signature)

        if inspect.iscoroutinefunction(func):
            return _wrap_coroutine_evaluation_function(
                name, annotator, wrapped_signature, scorer
            )(func)
        else:
            return _wrap_sync_evaluation_function(name, annotator, wrapped_signature, scorer)(
                func
            )

    return wrapper


def _wrap_coroutine_evaluation_function(
    name: str,
    annotator_kind: AnnotatorKind,
    sig: inspect.Signature,
    convert_to_score: Callable[[Any], EvaluationResult],
) -> Callable[[EvaluatorCallable], CanAsyncEvaluate]:
    def wrapper(func: EvaluatorCallable) -> CanAsyncEvaluate:
        class AsyncEvaluator:
            def __init__(self) -> None:
                self.name = name
                self.annotator_kind = annotator_kind.value

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
) -> Callable[[EvaluatorCallable], CanEvaluate]:
    def wrapper(func: EvaluatorCallable) -> CanEvaluate:
        class SyncEvaluator:
            def __init__(self) -> None:
                self.name = name
                self.annotator_kind = annotator_kind.value

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


def _default_eval_scorer(result: Any) -> EvaluationResult:
    if isinstance(result, bool):
        return EvaluationResult(score=float(result), label=str(result))
    elif isinstance(result, (int, float)):
        return EvaluationResult(score=float(result))
    elif isinstance(result, EvaluationResult):
        return result
    else:
        raise ValueError(f"Unsupported evaluation result type: {type(result)}")
