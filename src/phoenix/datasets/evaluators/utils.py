import functools
import inspect
from abc import ABC
from types import MappingProxyType
from typing import Any, Awaitable, Callable, Mapping, Optional, Union

from typing_extensions import TypeAlias

from phoenix.datasets.types import (
    AnnotatorKind,
    EvaluationResult,
    JSONSerializable,
    TaskOutput,
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


def validate_signature(sig: inspect.Signature) -> None:
    # Check that the wrapped function has a valid signature for use as an evaluator
    # If it does not, raise an error to exit early before running evaluations
    params = sig.parameters
    valid_named_params = {"input", "output", "expected", "metadata"}
    if len(params) == 0:
        raise ValueError("Evaluation function must have at least one parameter.")
    if len(params) > 1:
        for not_found in set(params) - valid_named_params:
            param = params[not_found]
            if (
                param.kind is inspect.Parameter.VAR_KEYWORD
                or param.default is not inspect.Parameter.empty
            ):
                continue
            raise ValueError(
                (
                    f"Invalid parameter names in evaluation function: {', '.join(not_found)}. "
                    "Parameters names for multi-argument functions must be "
                    f"any of: {', '.join(valid_named_params)}."
                )
            )


def _bind_signature(sig: inspect.Signature, **kwargs: Any) -> inspect.BoundArguments:
    parameter_mapping = {
        "input": kwargs.get("input"),
        "output": kwargs.get("output"),
        "expected": kwargs.get("expected"),
        "metadata": kwargs.get("metadata"),
    }
    params = sig.parameters
    if len(params) == 1:
        parameter_name = next(iter(params))
        if parameter_name in parameter_mapping:
            return sig.bind(parameter_mapping[parameter_name])
        else:
            return sig.bind(parameter_mapping["output"])
    return sig.bind_partial(
        **{name: parameter_mapping[name] for name in set(parameter_mapping).intersection(params)}
    )


def create_evaluator(
    kind: Union[str, AnnotatorKind] = AnnotatorKind.CODE,
    name: Optional[str] = None,
    scorer: Optional[Callable[[Any], EvaluationResult]] = None,
) -> Callable[[Callable[..., Any]], "Evaluator"]:
    if scorer is None:
        scorer = _default_eval_scorer

    if isinstance(kind, str):
        kind = AnnotatorKind(kind.upper())

    def wrapper(func: Callable[..., Any]) -> Evaluator:
        nonlocal name
        if not name:
            if hasattr(func, "__self__"):
                name = func.__self__.__class__.__name__
            elif hasattr(func, "__name__"):
                name = func.__name__
            else:
                name = str(func)
        assert name is not None

        wrapped_signature = inspect.signature(func)
        validate_signature(wrapped_signature)

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
) -> Callable[[Callable[..., Any]], "Evaluator"]:
    def wrapper(func: Callable[..., Any]) -> "Evaluator":
        class AsyncEvaluator(Evaluator):
            def __init__(self) -> None:
                self._name = name
                self._kind = annotator_kind

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
) -> Callable[[Callable[..., Any]], "Evaluator"]:
    def wrapper(func: Callable[..., Any]) -> "Evaluator":
        class SyncEvaluator(Evaluator):
            def __init__(self) -> None:
                self._name = name
                self._kind = annotator_kind

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


ExampleOutput: TypeAlias = Mapping[str, JSONSerializable]
ExampleMetadata: TypeAlias = Mapping[str, JSONSerializable]
ExampleInput: TypeAlias = Mapping[str, JSONSerializable]

EvaluatorName: TypeAlias = str
EvaluatorKind: TypeAlias = str
EvaluatorOutput: TypeAlias = Union[EvaluationResult, bool, int, float, str]


class Evaluator(ABC):
    """
    A helper super class to guide the implementation of an `Evaluator` object.
    Subclasses must implement either the `evaluate` or `async_evaluate` method.
    Implementing both methods is recommended, but not required.

    This Class is intended to be subclassed, and should not be instantiated directly.
    """

    _kind: AnnotatorKind
    _name: EvaluatorName

    @functools.cached_property
    def name(self) -> EvaluatorName:
        if hasattr(self, "_name"):
            return self._name
        return self.__class__.__name__

    @functools.cached_property
    def kind(self) -> EvaluatorKind:
        if hasattr(self, "_kind"):
            return self._kind.value
        return AnnotatorKind.CODE.value

    def __new__(cls, *args: Any, **kwargs: Any) -> "Evaluator":
        if cls is Evaluator:
            raise TypeError(f"{cls.__name__} is an abstract class and should not be instantiated.")
        return object.__new__(cls)

    def evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        expected: Optional[ExampleOutput] = None,
        metadata: ExampleMetadata = MappingProxyType({}),
        input: ExampleInput = MappingProxyType({}),
        **kwargs: Any,
    ) -> EvaluationResult:
        # For subclassing, one should implement either this sync method or the
        # async version. Implementing both is recommended but not required.
        raise NotImplementedError

    async def async_evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        expected: Optional[ExampleOutput] = None,
        metadata: ExampleMetadata = MappingProxyType({}),
        input: ExampleInput = MappingProxyType({}),
        **kwargs: Any,
    ) -> EvaluationResult:
        # For subclassing, one should implement either this async method or the
        # sync version. Implementing both is recommended but not required.
        return self.evaluate(
            output=output,
            expected=expected,
            metadata=metadata,
            input=input,
            **kwargs,
        )

    def __init_subclass__(cls, is_abstract: bool = False, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if is_abstract:
            return
        evaluate_fn_signature = inspect.signature(Evaluator.evaluate)
        for super_cls in inspect.getmro(cls):
            if super_cls in (LLMEvaluator, Evaluator):
                break
            if evaluate := super_cls.__dict__.get(Evaluator.evaluate.__name__):
                assert callable(evaluate), "`evaluate()` method should be callable"
                # need to remove the first param, i.e. `self`
                _validate_sig(functools.partial(evaluate, None), "evaluate")
                return
            if async_evaluate := super_cls.__dict__.get(Evaluator.async_evaluate.__name__):
                assert callable(async_evaluate), "`async_evaluate()` method should be callable"
                # need to remove the first param, i.e. `self`
                _validate_sig(functools.partial(async_evaluate, None), "async_evaluate")
                return
        raise ValueError(
            f"Evaluator must implement either "
            f"`def evaluate{evaluate_fn_signature}` or "
            f"`async def async_evaluate{evaluate_fn_signature}`"
        )


def _validate_sig(fn: Callable[..., Any], fn_name: str) -> None:
    sig = inspect.signature(fn)
    validate_signature(sig)
    for param in sig.parameters.values():
        if param.kind is inspect.Parameter.VAR_KEYWORD:
            return
    else:
        raise ValueError(f"`{fn_name}` should allow variadic keyword arguments `**kwargs`")


class LLMEvaluator(Evaluator, ABC, is_abstract=True):
    """
    A convenience super class for setting `kind` as LLM.

    This Class is intended to be subclassed, and should not be instantiated directly.
    """

    _kind = AnnotatorKind.LLM

    def __new__(cls, *args: Any, **kwargs: Any) -> "LLMEvaluator":
        if cls is LLMEvaluator:
            raise TypeError(f"{cls.__name__} is an abstract class and should not be instantiated.")
        return object.__new__(cls)


ExperimentEvaluator: TypeAlias = Union[
    Evaluator,
    Callable[..., EvaluatorOutput],
    Callable[..., Awaitable[EvaluatorOutput]],
]
