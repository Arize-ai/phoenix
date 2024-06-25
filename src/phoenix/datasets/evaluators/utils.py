import functools
import inspect
from typing import Any, Awaitable, Callable, Optional, Union

import wrapt

from phoenix.datasets.types import (
    AnnotatorKind,
    EvaluationResult,
    Evaluator,
    EvaluatorOutput,
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


wrapt.decorator()


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
                    "Parameters names for multi-argument functions must be "
                    f"any of: {', '.join(valid_named_params)}."
                )
            )


def _bind_signature(
    sig: inspect.Signature, example: Example, experiment_run: ExperimentRun
) -> inspect.BoundArguments:
    if experiment_run.output:
        raw_output = experiment_run.output.result
        if isinstance(raw_output, dict):
            output = raw_output.get("result", raw_output)
        else:
            output = raw_output
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
    kind: Union[str, AnnotatorKind] = AnnotatorKind.CODE,
    name: Optional[str] = None,
    scorer: Optional[Callable[[Any], EvaluationResult]] = None,
) -> Callable[[ExperimentEvaluator], ExperimentEvaluator]:
    if scorer is None:
        scorer = _default_eval_scorer

    if isinstance(kind, str):
        kind = AnnotatorKind(kind.upper())

    def wrapper(func: Callable[..., EvaluatorOutput]) -> ExperimentEvaluator:
        if name is None:
            name = func.__name__

        wrapped_signature = inspect.signature(func)
        _validate_signature(wrapped_signature)

        if inspect.iscoroutinefunction(func):
            return _wrap_coroutine_evaluation_function(name, kind, wrapped_signature, scorer)(func)
        else:
            return _wrap_sync_evaluation_function(name, kind, wrapped_signature, scorer)(func)

    return wrapper


def _wrap_coroutine_evaluation_function(
    name: str,
    annotator_kind: AnnotatorKind,
    sig: inspect.Signature,
    convert_to_score: Callable[[Any], EvaluationResult],
) -> Callable[[Callable[..., Awaitable[EvaluatorOutput]]], Evaluator]:
    def wrapper(func: Callable[..., Awaitable[EvaluatorOutput]]) -> Evaluator:
        class AsyncEvaluator(Evaluator):
            def __init__(self) -> None:
                self._name = name
                self._kind = annotator_kind.value

            @functools.wraps(func)
            async def __call__(self, *args: Any, **kwargs: Any) -> Any:
                return await func(*args, **kwargs)

            async def async_evaluate(self, **kwargs: Any) -> EvaluationResult:
                bound_signature = _bind_signature(sig, **kwargs)
                result = await func(*bound_signature.args, **bound_signature.kwargs)
                return convert_to_score(result)

        return AsyncEvaluator()

    return wrapper


def _wrap_sync_evaluation_function(
    name: str,
    annotator_kind: AnnotatorKind,
    sig: inspect.Signature,
    convert_to_score: Callable[[Any], EvaluationResult],
) -> Callable[[Callable[..., EvaluatorOutput]], Evaluator]:
    def wrapper(func: Callable[..., EvaluatorOutput]) -> Evaluator:
        class SyncEvaluator(Evaluator):
            def __init__(self) -> None:
                self._name = name
                self._kind = annotator_kind.value

            @functools.wraps(func)
            def __call__(self, *args: Any, **kwargs: Any) -> Any:
                return func(*args, **kwargs)

            def evaluate(self, **kwargs: Any) -> EvaluationResult:
                bound_signature = _bind_signature(sig, **kwargs)
                result = func(*bound_signature.args, **bound_signature.kwargs)
                return convert_to_score(result)

        return SyncEvaluator()

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
