from __future__ import annotations

import asyncio
import uuid
from typing import Any, Dict, List, Optional, Sequence
from unittest.mock import patch

import pytest
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from phoenix.client.resources.datasets import Dataset

from .._helpers import _ADMIN, _MEMBER, _await_or_return, _GetUser, _RoleOrUser


class SpanCapture:
    """Helper class to capture OpenTelemetry spans during testing."""

    def __init__(self) -> None:
        self.spans: List[ReadableSpan] = []

    def clear(self) -> None:
        self.spans.clear()


class CapturingSpanExporter(SpanExporter):
    """A span exporter that captures spans instead of sending them to a server."""

    def __init__(self, capture: SpanCapture) -> None:
        self.capture = capture

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        self.capture.spans.extend(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass


class TestExperimentsIntegration:
    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_run_experiment_basic(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_experiment_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"question": "What is 2+2?"},
                    {"question": "What is the capital of France?"},
                    {"question": "Who wrote Python?"},
                ],
                outputs=[
                    {"answer": "4"},
                    {"answer": "Paris"},
                    {"answer": "Guido van Rossum"},
                ],
                metadata=[
                    {"category": "math"},
                    {"category": "geography"},
                    {"category": "programming"},
                ],
            )
        )

        def simple_task(input: Dict[str, Any]) -> str:
            question = input.get("question", "")
            if "2+2" in question:
                return "The answer is 4"
            elif "capital" in question:
                return "The capital is Paris"
            else:
                return "I don't know"

        result = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                experiment_name=f"test_experiment_{uuid.uuid4().hex[:8]}",
                experiment_description="A simple test experiment",
                print_summary=False,
            )
        )

        assert "experiment_id" in result
        assert "dataset_id" in result
        assert "task_runs" in result
        assert "evaluation_runs" in result
        assert result["dataset_id"] == dataset.id
        assert len(result["task_runs"]) == 3
        assert len(result["evaluation_runs"]) == 0

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_creates_proper_spans(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that experiments create proper OpenTelemetry spans with correct attributes."""
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_span_creation_{uuid.uuid4().hex[:8]}"

        # Create a small dataset for testing
        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"text": "Hello world"},
                    {"text": "Python is great"},
                ],
                outputs=[
                    {"expected": "greeting"},
                    {"expected": "programming"},
                ],
                metadata=[
                    {"category": "test"},
                    {"category": "test"},
                ],
            )
        )

        def classification_task(input: Dict[str, Any]) -> str:
            text = input.get("text", "")
            if "Hello" in text:
                return "greeting"
            elif "Python" in text:
                return "programming"
            else:
                return "unknown"

        def accuracy_evaluator(output: str) -> float:
            return 1.0 if output in ["greeting", "programming"] else 0.0

        span_capture = SpanCapture()
        capturing_exporter = CapturingSpanExporter(span_capture)

        from openinference.semconv.resource import ResourceAttributes
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor

        def mock_get_tracer(
            project_name: Optional[str] = None,
            base_url: Optional[str] = None,
            headers: Optional[Dict[str, str]] = None,
        ) -> tuple[Any, Any]:
            resource = Resource(
                {ResourceAttributes.PROJECT_NAME: project_name} if project_name else {}
            )
            tracer_provider = TracerProvider(resource=resource)
            span_processor = SimpleSpanProcessor(capturing_exporter)
            tracer_provider.add_span_processor(span_processor)
            return tracer_provider.get_tracer(__name__), resource

        experiments_module = "phoenix.client.resources.experiments"

        with patch(f"{experiments_module}._get_tracer", side_effect=mock_get_tracer):
            result = await _await_or_return(
                Client().experiments.run_experiment(
                    dataset=dataset,
                    task=classification_task,
                    evaluators={"accuracy_evaluator": accuracy_evaluator},
                    experiment_name=f"test_span_experiment_{uuid.uuid4().hex[:8]}",
                    print_summary=False,
                )
            )

        assert len(result["task_runs"]) == 2
        assert len(result["evaluation_runs"]) == 2

        assert len(span_capture.spans) > 0, "No spans were captured"

        task_spans: List[ReadableSpan] = []
        eval_spans: List[ReadableSpan] = []

        for span in span_capture.spans:
            if span.attributes is not None:
                span_kind = span.attributes.get("openinference.span.kind")
                if span_kind == "CHAIN":
                    task_spans.append(span)
                elif span_kind == "EVALUATOR":
                    eval_spans.append(span)

        assert len(task_spans) == 2, f"Expected 2 task spans, got {len(task_spans)}"

        for task_span in task_spans:
            assert task_span.name == "Task: classification_task"

            if task_span.attributes is not None:
                assert task_span.attributes.get("openinference.span.kind") == "CHAIN"
                assert "input.value" in task_span.attributes
                assert "input.mime_type" in task_span.attributes
                assert "output.value" in task_span.attributes

            assert task_span.status.status_code.name == "OK"

        assert len(eval_spans) == 2, f"Expected 2 evaluation spans, got {len(eval_spans)}"

        for eval_span in eval_spans:
            assert eval_span.name == "Evaluation: accuracy_evaluator"

            if eval_span.attributes is not None:
                assert eval_span.attributes.get("openinference.span.kind") == "EVALUATOR"

            assert eval_span.status.status_code.name == "OK"

        for span in span_capture.spans:
            project_name = span.resource.attributes.get(ResourceAttributes.PROJECT_NAME)
            assert project_name is not None and project_name != ""

        for span in span_capture.spans:
            span_context = span.get_span_context()
            if span_context is not None:
                assert span_context.trace_id != 0, "Span should have a valid trace ID"

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_run_experiment_with_evaluators(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_experiment_eval_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"text": "Hello world"},
                    {"text": "Python is great"},
                ],
                outputs=[
                    {"expected": "greeting"},
                    {"expected": "programming"},
                ],
            )
        )

        def classification_task(input: Dict[str, Any]) -> str:
            text = input.get("text", "")
            if "Hello" in text:
                return "greeting"
            elif "Python" in text:
                return "programming"
            else:
                return "unknown"

        def accuracy_evaluator(output: str, expected: Dict[str, Any]) -> float:
            return 1.0 if output == expected.get("expected") else 0.0

        def length_evaluator(output: str) -> Dict[str, Any]:
            return {"score": len(output) / 10.0, "label": "length_score"}

        result = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=classification_task,
                evaluators=[accuracy_evaluator, length_evaluator],
                experiment_name=f"test_eval_experiment_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 2
        assert len(result["evaluation_runs"]) > 0

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_with_different_task_signatures(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_signatures_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[{"prompt": "Test prompt"}],
                outputs=[{"response": "Test response"}],
                metadata=[{"source": "test"}],
            )
        )

        def task_with_input_only(input: Dict[str, Any]) -> str:
            return f"Processed: {input.get('prompt', '')}"

        def task_with_multiple_params(
            input: Dict[str, Any], expected: Dict[str, Any], metadata: Dict[str, Any]
        ) -> str:
            return f"Input: {input}, Expected: {expected}, Meta: {metadata}"

        result1 = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=task_with_input_only,
                experiment_name=f"test_input_only_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result1["task_runs"]) == 1

        result2 = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=task_with_multiple_params,
                experiment_name=f"test_multi_params_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result2["task_runs"]) == 1

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_dry_run(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_dry_run_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"text": "Sample 1"},
                    {"text": "Sample 2"},
                    {"text": "Sample 3"},
                ],
                outputs=[
                    {"result": "Result 1"},
                    {"result": "Result 2"},
                    {"result": "Result 3"},
                ],
            )
        )

        def simple_task(input: Dict[str, Any]) -> str:
            return f"Processed: {input.get('text', '')}"

        result = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                experiment_name="dry_run_test",
                dry_run=True,
                print_summary=False,
            )
        )

        assert result["experiment_id"] == "DRY_RUN"
        assert len(result["task_runs"]) == 1

        result_sized = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                experiment_name="dry_run_sized_test",
                dry_run=2,
                print_summary=False,
            )
        )

        assert len(result_sized["task_runs"]) == 2

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_with_metadata(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_metadata_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[{"question": "Test question"}],
                outputs=[{"answer": "Test answer"}],
            )
        )

        def simple_task(input: Dict[str, Any]) -> str:
            return "Test response"

        experiment_metadata = {
            "version": "1.0",
            "model": "test-model",
            "temperature": 0.7,
        }

        result = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                experiment_name=f"test_with_metadata_{uuid.uuid4().hex[:8]}",
                experiment_description="Experiment with metadata",
                experiment_metadata=experiment_metadata,
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 1

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_evaluator_types(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_eval_types_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "Hello world"}],
                outputs=[{"expected": "greeting"}],
            )
        )

        def simple_task(input: Dict[str, Any]) -> str:
            return "greeting"

        def bool_evaluator(output: str) -> bool:
            return output == "greeting"

        def float_evaluator(output: str) -> float:
            return 0.95

        def tuple_evaluator(output: str) -> tuple[float, str, str]:
            return (1.0, "correct", "The output matches expectation")

        def dict_evaluator(output: str) -> Dict[str, Any]:
            return {"score": 0.8, "label": "good"}

        result = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                evaluators={
                    "bool_eval": bool_evaluator,
                    "float_eval": float_evaluator,
                    "tuple_eval": tuple_evaluator,
                    "dict_eval": dict_evaluator,
                },
                experiment_name=f"test_eval_types_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 1
        assert len(result["evaluation_runs"]) > 0

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_async_task(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        if not is_async:
            pytest.skip("Async tasks only supported with AsyncClient")

        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient

        unique_name = f"test_async_task_{uuid.uuid4().hex[:8]}"

        dataset: Dataset = await _await_or_return(
            AsyncClient().datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "Async test"}],
                outputs=[{"expected": "async_result"}],
            )
        )

        async def async_task(input: Dict[str, Any]) -> str:
            await asyncio.sleep(0.1)
            return f"async_processed_{input.get('text', '')}"

        result = await AsyncClient().experiments.run_experiment(
            dataset=dataset,
            task=async_task,
            experiment_name=f"test_async_{uuid.uuid4().hex[:8]}",
            print_summary=False,
        )

        assert len(result["task_runs"]) == 1
        assert "async_processed_" in result["task_runs"][0]["output"]

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_error_handling(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_error_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "test"}],
                outputs=[{"expected": "result"}],
            )
        )

        def failing_task(input: Dict[str, Any]) -> str:
            raise ValueError("Task failed intentionally")

        result = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=failing_task,
                experiment_name=f"test_error_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 1
        assert "error" in result["task_runs"][0] or result["task_runs"][0]["output"] is None

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_experiment_with_empty_dataset(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_empty_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[{"placeholder": "temp"}],
                outputs=[{"placeholder": "temp"}],
            )
        )

        class EmptyDataset:
            def __init__(self, original_dataset: Any) -> None:
                self.id = original_dataset.id
                self.version_id = original_dataset.version_id
                self.examples: List[Any] = []

        empty_dataset = EmptyDataset(dataset)

        def simple_task(input: Dict[str, Any]) -> str:
            return "test"

        with pytest.raises(ValueError, match="Dataset has no examples"):
            await _await_or_return(
                Client().experiments.run_experiment(
                    dataset=empty_dataset,  # type: ignore[arg-type]
                    task=simple_task,
                    experiment_name="test_empty",
                    print_summary=False,
                )
            )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_evaluator_dynamic_parameter_binding(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_eval_params_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"text": "What is 2+2?", "context": "math"},
                    {"text": "What is the capital of France?", "context": "geography"},
                ],
                outputs=[
                    {"answer": "4", "category": "arithmetic"},
                    {"answer": "Paris", "category": "location"},
                ],
                metadata=[
                    {"difficulty": "easy", "topic": "math"},
                    {"difficulty": "medium", "topic": "geography"},
                ],
            )
        )

        def question_answering_task(input: Dict[str, Any]) -> str:
            question = input.get("text", "")
            if "2+2" in question:
                return "The answer is 4"
            elif "capital" in question:
                return "The answer is Paris"
            else:
                return "I don't know"

        def output_only_evaluator(output: str) -> float:
            return 1.0 if "answer" in output.lower() else 0.0

        def accuracy_evaluator(output: str, expected: Dict[str, Any]) -> float:
            expected_answer = expected.get("answer", "")
            return 1.0 if expected_answer in output else 0.0

        def comprehensive_evaluator(
            input: Dict[str, Any],
            output: str,
            expected: Dict[str, Any],
            reference: Dict[str, Any],
            metadata: Dict[str, Any],
        ) -> Dict[str, Any]:
            has_input = bool(input.get("text"))
            has_output = bool(output)
            has_expected = bool(expected.get("answer"))
            has_reference = bool(reference.get("answer"))
            has_metadata = bool(metadata.get("difficulty"))

            reference_matches_expected = reference == expected

            score = (
                1.0
                if all(
                    [
                        has_input,
                        has_output,
                        has_expected,
                        has_reference,
                        has_metadata,
                        reference_matches_expected,
                    ]
                )
                else 0.0
            )

            return {
                "score": score,
                "label": "comprehensive_check",
                "explanation": (
                    f"Input: {has_input}, Output: {has_output}, Expected: {has_expected}, "
                    f"Reference: {has_reference}, Metadata: {has_metadata}, "
                    f"Reference==Expected: {reference_matches_expected}"
                ),
            }

        def reference_evaluator(output: str, reference: Dict[str, Any]) -> float:
            reference_answer = reference.get("answer", "")
            return 1.0 if reference_answer in output else 0.0

        def metadata_evaluator(output: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
            difficulty = metadata.get("difficulty", "unknown")
            topic = metadata.get("topic", "unknown")

            return {
                "score": 0.8 if difficulty == "easy" else 0.6,
                "label": f"{difficulty}_{topic}",
                "explanation": f"Difficulty: {difficulty}, Topic: {topic}",
            }

        result = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=question_answering_task,
                evaluators={
                    "output_only": output_only_evaluator,
                    "accuracy": accuracy_evaluator,
                    "comprehensive": comprehensive_evaluator,
                    "reference": reference_evaluator,
                    "metadata": metadata_evaluator,
                },
                experiment_name=f"test_param_binding_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 2
        assert len(result["evaluation_runs"]) == 10  # 2 examples * 5 evaluators

        comprehensive_evals = [
            eval_run for eval_run in result["evaluation_runs"] if eval_run.name == "comprehensive"
        ]
        assert len(comprehensive_evals) == 2

        for eval_run in comprehensive_evals:
            assert eval_run.result is not None
            assert eval_run.result["score"] == 1.0
            assert "comprehensive_check" in eval_run.result["label"]

        reference_evals = [
            eval_run for eval_run in result["evaluation_runs"] if eval_run.name == "reference"
        ]
        assert len(reference_evals) == 2

        for eval_run in reference_evals:
            assert eval_run.result is not None
            assert eval_run.result["score"] == 1.0

        metadata_evals = [
            eval_run for eval_run in result["evaluation_runs"] if eval_run.name == "metadata"
        ]
        assert len(metadata_evals) == 2

        for eval_run in metadata_evals:
            assert eval_run.result is not None
            assert "score" in eval_run.result
            assert "label" in eval_run.result
            assert "explanation" in eval_run.result

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_task_dynamic_parameter_binding(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_task_params_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"question": "What is 2+2?", "type": "math"},
                    {"question": "What is the capital of France?", "type": "geography"},
                ],
                outputs=[
                    {"answer": "4", "explanation": "Basic arithmetic"},
                    {"answer": "Paris", "explanation": "Capital city of France"},
                ],
                metadata=[
                    {"difficulty": "easy", "category": "arithmetic", "source": "textbook"},
                    {"difficulty": "medium", "category": "geography", "source": "atlas"},
                ],
            )
        )

        def input_only_task(input: Dict[str, Any]) -> str:
            question = input.get("question", "")
            return f"Processing: {question}"

        def input_expected_task(input: Dict[str, Any], expected: Dict[str, Any]) -> str:
            question = input.get("question", "")
            expected_answer = expected.get("answer", "")
            return f"Question: {question}, Expected: {expected_answer}"

        def reference_task(input: Dict[str, Any], reference: Dict[str, Any]) -> str:
            question = input.get("question", "")
            ref_answer = reference.get("answer", "")
            return f"Q: {question}, Ref: {ref_answer}"

        def metadata_task(input: Dict[str, Any], metadata: Dict[str, Any]) -> str:
            question = input.get("question", "")
            difficulty = metadata.get("difficulty", "unknown")
            category = metadata.get("category", "unknown")
            return f"Q: {question} [Difficulty: {difficulty}, Category: {category}]"

        def comprehensive_task(
            input: Dict[str, Any],
            expected: Dict[str, Any],
            reference: Dict[str, Any],
            metadata: Dict[str, Any],
            example: Dict[str, Any],
        ) -> Dict[str, Any]:
            has_input = bool(input.get("question"))
            has_expected = bool(expected.get("answer"))
            has_reference = bool(reference.get("answer"))
            has_metadata = bool(metadata.get("difficulty"))
            has_example = bool(example.get("id"))  # Example should have an ID
            reference_matches_expected = reference == expected

            success = all(
                [
                    has_input,
                    has_expected,
                    has_reference,
                    has_metadata,
                    has_example,
                    reference_matches_expected,
                ]
            )

            return {
                "success": success,
                "question": input.get("question", ""),
                "expected_answer": expected.get("answer", ""),
                "metadata_difficulty": metadata.get("difficulty", ""),
                "example_id": example.get("id", ""),
                "reference_matches_expected": reference_matches_expected,
            }

        result1 = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=input_only_task,
                experiment_name=f"test_input_only_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result1["task_runs"]) == 2
        for task_run in result1["task_runs"]:
            assert "Processing:" in task_run["output"]

        result2 = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=input_expected_task,
                experiment_name=f"test_input_expected_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result2["task_runs"]) == 2
        for task_run in result2["task_runs"]:
            assert "Question:" in task_run["output"]
            assert "Expected:" in task_run["output"]

        result3 = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=reference_task,
                experiment_name=f"test_reference_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result3["task_runs"]) == 2
        for task_run in result3["task_runs"]:
            assert "Q:" in task_run["output"]
            assert "Ref:" in task_run["output"]

        result4 = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=metadata_task,
                experiment_name=f"test_metadata_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result4["task_runs"]) == 2
        for task_run in result4["task_runs"]:
            assert "Difficulty:" in task_run["output"]
            assert "Category:" in task_run["output"]

        result5 = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=comprehensive_task,
                experiment_name=f"test_comprehensive_{uuid.uuid4().hex[:8]}",
                print_summary=False,
            )
        )

        assert len(result5["task_runs"]) == 2
        for task_run in result5["task_runs"]:
            output = task_run["output"]
            assert isinstance(output, dict)
            assert output["success"] is True
            assert output["reference_matches_expected"] is True
            assert output["question"] != ""
            assert output["expected_answer"] != ""
            assert output["metadata_difficulty"] != ""
            assert output["example_id"] != ""
