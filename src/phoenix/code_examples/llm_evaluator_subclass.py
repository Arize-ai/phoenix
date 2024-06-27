from types import MappingProxyType
from typing import Any, Optional

from phoenix.datasets.evaluators.base import LLMEvaluator
from phoenix.datasets.types import (
    EvaluationResult,
    ExampleInput,
    ExampleMetadata,
    ExampleOutput,
    TaskOutput,
)


class MyLLMEvaluator(LLMEvaluator):
    # A name for the evaluator (if not provided, the class name will be used).
    _name = "my-llm-evaluator"

    def evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        expected: Optional[ExampleOutput] = None,
        metadata: ExampleMetadata = MappingProxyType({}),
        input: ExampleInput = MappingProxyType({}),
        **kwargs: Any,
    ) -> EvaluationResult:
        # Implement this method or the async method.
        raise NotImplementedError("evaluate method not implemented")

    async def async_evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        expected: Optional[ExampleOutput] = None,
        metadata: ExampleMetadata = MappingProxyType({}),
        input: ExampleInput = MappingProxyType({}),
        **kwargs: Any,
    ) -> EvaluationResult:
        # Implement this method or the sync method.
        raise NotImplementedError("async_evaluate method not implemented")
