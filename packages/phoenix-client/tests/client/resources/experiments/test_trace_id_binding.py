# pyright: reportPrivateUsage=false
import inspect
from typing import Any, Optional

import pytest

from phoenix.client.resources.experiments.evaluators import (
    _bind_evaluator_signature,
    create_evaluator,
    validate_evaluator_signature,
)
from phoenix.client.resources.experiments.types import (
    _validate_evaluator_signature,
)


class TestValidateEvaluatorSignatureAcceptsTraceId:
    """Test that trace_id is accepted as a valid parameter name."""

    def test_trace_id_only(self) -> None:
        def evaluator(trace_id: str) -> bool:
            return True

        sig = inspect.signature(evaluator)
        validate_evaluator_signature(sig)

    def test_trace_id_with_output(self) -> None:
        def evaluator(output: Any, trace_id: str) -> bool:
            return True

        sig = inspect.signature(evaluator)
        validate_evaluator_signature(sig)

    def test_trace_id_with_all_params(self) -> None:
        def evaluator(
            input: Any,
            output: Any,
            expected: Any,
            metadata: Any,
            trace_id: str,
        ) -> bool:
            return True

        sig = inspect.signature(evaluator)
        validate_evaluator_signature(sig)


class TestPrivateValidateEvaluatorSignatureAcceptsTraceId:
    """Test that _validate_evaluator_signature also accepts trace_id."""

    def test_trace_id_only(self) -> None:
        def evaluator(trace_id: str) -> bool:
            return True

        sig = inspect.signature(evaluator)
        _validate_evaluator_signature(sig)

    def test_trace_id_with_output(self) -> None:
        def evaluator(output: Any, trace_id: str) -> bool:
            return True

        sig = inspect.signature(evaluator)
        _validate_evaluator_signature(sig)


class TestBindEvaluatorSignatureWithTraceId:
    """Test that trace_id is correctly bound in evaluator signatures."""

    def test_trace_id_bound_when_requested(self) -> None:
        def evaluator(output: Any, trace_id: Optional[str] = None) -> bool:
            return True

        sig = inspect.signature(evaluator)
        bound = _bind_evaluator_signature(
            sig,
            output="test output",
            trace_id="abc123",
        )
        assert bound.arguments["trace_id"] == "abc123"

    def test_trace_id_none_when_missing(self) -> None:
        def evaluator(output: Any, trace_id: Optional[str] = None) -> bool:
            return True

        sig = inspect.signature(evaluator)
        bound = _bind_evaluator_signature(
            sig,
            output="test output",
        )
        assert bound.arguments["trace_id"] is None

    def test_trace_id_not_bound_when_not_in_signature(self) -> None:
        def evaluator(output: Any) -> bool:
            return True

        sig = inspect.signature(evaluator)
        bound = _bind_evaluator_signature(
            sig,
            output="test output",
            trace_id="abc123",
        )
        assert "trace_id" not in bound.arguments

    def test_trace_id_with_all_params(self) -> None:
        def evaluator(
            input: Any,
            output: Any,
            expected: Any,
            metadata: Any,
            trace_id: Optional[str] = None,
        ) -> bool:
            return True

        sig = inspect.signature(evaluator)
        bound = _bind_evaluator_signature(
            sig,
            input={"question": "test"},
            output="test output",
            expected={"answer": "expected"},
            metadata={"key": "value"},
            trace_id="trace-xyz",
        )
        assert bound.arguments["trace_id"] == "trace-xyz"
        assert bound.arguments["output"] == "test output"


class TestCreateEvaluatorWithTraceId:
    """Test that evaluators created with create_evaluator receive trace_id."""

    def test_sync_evaluator_receives_trace_id(self) -> None:
        received: dict[str, Any] = {}

        @create_evaluator(kind="CODE", name="test-eval")
        def evaluator(output: Any, trace_id: Optional[str] = None) -> bool:
            received["trace_id"] = trace_id
            return True

        evaluator.evaluate(
            output="test",
            trace_id="abc123",
        )
        assert received["trace_id"] == "abc123"

    def test_sync_evaluator_receives_none_trace_id(self) -> None:
        received: dict[str, Any] = {}

        @create_evaluator(kind="CODE", name="test-eval-none")
        def evaluator(output: Any, trace_id: Optional[str] = None) -> bool:
            received["trace_id"] = trace_id
            return True

        evaluator.evaluate(output="test")
        assert received["trace_id"] is None

    @pytest.mark.anyio
    async def test_async_evaluator_receives_trace_id(self) -> None:
        received: dict[str, Any] = {}

        @create_evaluator(kind="CODE", name="test-eval-async")
        async def evaluator(output: Any, trace_id: Optional[str] = None) -> bool:
            received["trace_id"] = trace_id
            return True

        await evaluator.async_evaluate(
            output="test",
            trace_id="async-trace-123",
        )
        assert received["trace_id"] == "async-trace-123"
