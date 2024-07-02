import functools
import inspect
from abc import ABC
from types import MappingProxyType
from typing import Any, Awaitable, Callable, Optional, Union

from typing_extensions import TypeAlias

from phoenix.experiments.evaluators.utils import validate_evaluator_signature
from phoenix.experiments.types import (
    AnnotatorKind,
    EvaluationResult,
    EvaluatorKind,
    EvaluatorName,
    EvaluatorOutput,
    ExampleInput,
    ExampleMetadata,
    ExampleOutput,
    TaskOutput,
)


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
    validate_evaluator_signature(sig)
    for param in sig.parameters.values():
        if param.kind is inspect.Parameter.VAR_KEYWORD:
            return
    else:
        raise ValueError(f"`{fn_name}` should allow variadic keyword arguments `**kwargs`")


class CodeEvaluator(Evaluator, ABC, is_abstract=True):
    """
    A convenience super class for defining code evaluators.

    This class is intended to be subclassed, and should not be instantiated directly.
    """

    _kind = AnnotatorKind.CODE

    def __new__(cls, *args: Any, **kwargs: Any) -> "CodeEvaluator":
        if cls is CodeEvaluator:
            raise TypeError(f"{cls.__name__} is an abstract class and should not be instantiated.")
        return object.__new__(cls)


class LLMEvaluator(Evaluator, ABC, is_abstract=True):
    """
    A convenience super class for defining LLM evaluators.

    This class is intended to be subclassed, and should not be instantiated directly.
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
