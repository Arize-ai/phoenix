from __future__ import annotations

import asyncio
import uuid
from typing import Any, Dict, List

import pytest
from phoenix.client.resources.datasets import Dataset

from .._helpers import _ADMIN, _MEMBER, _await_or_return, _GetUser, _RoleOrUser


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
    async def test_experiment_without_opentelemetry(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that experiments work correctly when OpenTelemetry is not installed."""
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Mock _try_import_opentelemetry to return None (simulating OTel not installed)
        import phoenix.client.resources.experiments

        monkeypatch.setattr(
            phoenix.client.resources.experiments, "_try_import_opentelemetry", lambda: None
        )

        unique_name = f"test_no_otel_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"question": "What is 2+2?"},
                    {"question": "What is the capital of France?"},
                ],
                outputs=[
                    {"answer": "4"},
                    {"answer": "Paris"},
                ],
                metadata=[
                    {"category": "math"},
                    {"category": "geography"},
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

        def accuracy_evaluator(output: str, expected: Dict[str, Any]) -> float:
            return 1.0 if output == expected.get("answer") else 0.0

        result = await _await_or_return(
            Client().experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                evaluators=[accuracy_evaluator],
                experiment_name=f"test_no_otel_{uuid.uuid4().hex[:8]}",
                experiment_description="Test without OpenTelemetry",
                print_summary=False,
            )
        )

        # Verify experiment works correctly without OpenTelemetry
        assert "experiment_id" in result
        assert "dataset_id" in result
        assert "task_runs" in result
        assert "evaluation_runs" in result
        assert result["dataset_id"] == dataset.id
        assert len(result["task_runs"]) == 2
        assert len(result["evaluation_runs"]) == 2

        for task_run in result["task_runs"]:
            assert "dataset_example_id" in task_run
            assert "output" in task_run
            assert "start_time" in task_run
            assert "end_time" in task_run
            assert task_run["output"] is not None

        for eval_run in result["evaluation_runs"]:
            assert hasattr(eval_run, "experiment_run_id")
            assert hasattr(eval_run, "start_time")
            assert hasattr(eval_run, "end_time")
            assert hasattr(eval_run, "name")
            assert eval_run.experiment_run_id is not None
            assert eval_run.name is not None
