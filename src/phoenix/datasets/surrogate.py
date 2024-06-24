from __future__ import annotations

import inspect
from abc import ABC
from dataclasses import dataclass
from typing import Any, Awaitable, Optional

from phoenix.datasets.errors import EvaluatorImplementationError
from phoenix.datasets.types import (
    EvaluationResult,
    Evaluator,
    EvaluatorKind,
    EvaluatorName,
    ExperimentEvaluator,
    validate_evaluate_fn_params,
)


@dataclass(frozen=True)
class SurrogateEvaluator(Evaluator, ABC):
    __wrapped__: ExperimentEvaluator

    def __new__(cls, *args: Any, **kwargs: Any) -> SurrogateEvaluator:
        if cls is SurrogateEvaluator:
            raise TypeError(f"{cls.__name__} is an abstract class.")
        return object.__new__(cls)

    def __init__(
        self,
        wrapped: ExperimentEvaluator,
        /,
        *,
        name: Optional[EvaluatorName] = None,
        kind: Optional[EvaluatorKind] = None,
    ) -> None:
        if not isinstance(wrapped, Evaluator):
            if not callable(wrapped):
                raise EvaluatorImplementationError(f"{wrapped} is not callable")
            validate_evaluate_fn_params(wrapped)
        if name:
            _name = name
        elif isinstance(wrapped, Evaluator):
            _name = wrapped.name
        elif hasattr(wrapped, "__self__"):
            _name = wrapped.__self__.__class__.__name__
        else:
            _name = wrapped.__name__
        if kind:
            _kind = kind
        elif isinstance(wrapped, Evaluator):
            _kind = wrapped.kind
        else:
            _kind = "CODE"
        object.__setattr__(self, "_kind", _kind)
        object.__setattr__(self, "_name", _name)
        object.__setattr__(self, "__wrapped__", wrapped)

    def evaluate(self, **kwargs: Any) -> EvaluationResult:
        if isinstance(self.__wrapped__, Evaluator):
            return self.__wrapped__.evaluate(**kwargs)
        ans = self.__wrapped__(**inspect.signature(self.__wrapped__).bind(**kwargs).arguments)
        if isinstance(ans, Awaitable):
            raise RuntimeError(f"{self.__wrapped__} is async function")
        if isinstance(ans, str):
            return EvaluationResult(label=ans)
        if isinstance(ans, (bool, int, float)):
            return EvaluationResult(score=float(ans))
        return ans

    async def async_evaluate(self, **kwargs: Any) -> EvaluationResult:
        if isinstance(self.__wrapped__, Evaluator):
            return await self.__wrapped__.async_evaluate(**kwargs)
        ans = self.__wrapped__(**inspect.signature(self.__wrapped__).bind(**kwargs).arguments)
        if isinstance(ans, Awaitable):
            ans = await ans
        if isinstance(ans, str):
            return EvaluationResult(label=ans)
        if isinstance(ans, (bool, int, float)):
            return EvaluationResult(score=float(ans))
        return ans
