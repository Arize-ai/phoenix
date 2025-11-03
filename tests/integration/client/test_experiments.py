from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from secrets import token_hex
from typing import Any, Callable, Dict, Iterator, Optional, Sequence, Union, cast
from unittest.mock import patch

import pytest
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from strawberry.relay import GlobalID

from phoenix.client import AsyncClient
from phoenix.client import Client as SyncClient
from phoenix.client.__generated__ import v1
from phoenix.client.resources.datasets import Dataset

from .._helpers import (  # pyright: ignore[reportPrivateUsage]
    _AppInfo,
    _await_or_return,
    _gql,
    _httpx_client,
)


class _ExperimentTestHelper:
    """
    General-purpose helper for experiment integration tests.

    Provides HTTP-based CRUD operations for datasets, experiments, runs, and evaluations.
    """

    def __init__(self, _app: _AppInfo) -> None:
        self._app = _app
        self.http_client = _httpx_client(_app, _app.admin_secret)
        self.now = datetime.now(timezone.utc).isoformat()
        self._created_datasets: list[str] = []

    def post_json(self, url: str, **kwargs: Any) -> Any:
        """Helper to POST and return parsed JSON response data."""
        response = self.http_client.post(url, **kwargs)
        response.raise_for_status()
        return response.json()["data"]

    def get_data(self, url: str) -> Any:
        """Helper to GET and return parsed JSON response data."""
        response = self.http_client.get(url)
        response.raise_for_status()
        return response.json()["data"]

    def create_dataset(
        self, inputs: list[dict[str, Any]], outputs: list[dict[str, Any]]
    ) -> tuple[str, list[v1.DatasetExample]]:
        """Create a dataset with a randomly generated name and return (dataset_id, examples)."""
        name = f"test_dataset_{token_hex(4)}"
        upload_result = self.post_json(
            "v1/datasets/upload?sync=true",
            json={
                "action": "create",
                "name": name,
                "inputs": inputs,
                "outputs": outputs,
            },
        )

        dataset_id = upload_result["dataset_id"]
        self._created_datasets.append(dataset_id)

        # Get examples
        examples_data = self.get_data(f"v1/datasets/{dataset_id}/examples")
        examples = cast(list[v1.DatasetExample], examples_data["examples"])
        return dataset_id, examples

    def create_experiment(self, dataset_id: str, repetitions: int) -> v1.Experiment:
        """Create an experiment and return the experiment object."""
        return cast(
            v1.Experiment,
            self.post_json(
                f"v1/datasets/{dataset_id}/experiments", json={"repetitions": repetitions}
            ),
        )

    def create_runs(
        self,
        exp_id: str,
        runs: list[tuple[str, int, Optional[str], Optional[str]]],
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
    ) -> list[v1.CreateExperimentRunResponseBodyData]:
        """
        Create experiment runs.

        Args:
            exp_id: Experiment ID
            runs: List of (example_id, repetition, output, error) tuples
            start_time: Optional start time (defaults to self.now)
            end_time: Optional end time (defaults to self.now)
        """
        created_runs: list[v1.CreateExperimentRunResponseBodyData] = []
        for example_id, rep, output, error in runs:
            run_data = self.post_json(
                f"v1/experiments/{exp_id}/runs",
                json={
                    "dataset_example_id": example_id,
                    "repetition_number": rep,
                    "output": output,
                    "error": error,
                    "start_time": start_time or self.now,
                    "end_time": end_time or self.now,
                },
            )
            created_runs.append(cast(v1.CreateExperimentRunResponseBodyData, run_data))
        return created_runs

    def get_runs(self, experiment_id: str) -> list[v1.ExperimentRun]:
        """Get all runs for an experiment."""
        return cast(list[v1.ExperimentRun], self.get_data(f"v1/experiments/{experiment_id}/runs"))

    def create_evaluation(
        self,
        run_id: str,
        name: str,
        score: Optional[float] = None,
        error: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
    ) -> v1.UpsertExperimentEvaluationResponseBodyData:
        """
        Create a single evaluation annotation.

        Args:
            run_id: Experiment run ID
            name: Evaluator name
            score: Optional score (if successful)
            error: Optional error message (if failed)
            start_time: Optional start time (defaults to self.now)
            end_time: Optional end time (defaults to self.now)
        """
        payload: dict[str, Any] = {
            "experiment_run_id": run_id,
            "name": name,
            "annotator_kind": "CODE",
            "start_time": start_time or self.now,
            "end_time": end_time or self.now,
        }

        if error is not None:
            payload["error"] = error
        elif score is not None:
            payload["result"] = {"score": score}
        else:
            payload["result"] = {"score": 1.0}  # Default success

        return cast(
            v1.UpsertExperimentEvaluationResponseBodyData,
            self.post_json("v1/experiment_evaluations", json=payload),
        )

    def create_evaluations(
        self,
        exp_id: str,
        success_evaluators: list[str],
        failed_evaluator_names: Optional[list[str]] = None,
        score: float = 1.0,
    ) -> None:
        """
        Create evaluation annotations for all runs in an experiment.

        Args:
            exp_id: Experiment ID
            success_evaluators: List of evaluator names to create with success
            failed_evaluator_names: List of evaluator names to create with errors
            score: Score to use for successful evaluations (default: 1.0)
        """
        runs = self.get_runs(exp_id)
        failed_evaluator_names = failed_evaluator_names or []

        for run in runs:
            run_id = run["id"]

            for eval_name in success_evaluators:
                self.create_evaluation(run_id, eval_name, score=score)

            for eval_name in failed_evaluator_names:
                self.create_evaluation(run_id, eval_name, error="Evaluator failed")

    def get_experiment_annotations(self, exp_id: str) -> dict[str, Any]:
        """Fetch experiment runs and annotations via GraphQL with pagination."""
        query = """
            query GetExperimentRuns($experimentId: ID!, $cursor: String) {
                node(id: $experimentId) {
                    ... on Experiment {
                        runs(first: 100, after: $cursor) {
                            edges {
                                run: node {
                                    annotations {
                                        edges {
                                            annotation: node {
                                                name
                                                score
                                                error
                                            }
                                        }
                                    }
                                }
                            }
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                        }
                    }
                }
            }
        """
        # Fetch all runs by following pagination
        all_runs: list[dict[str, Any]] = []
        cursor: str | None = None

        while True:
            data, _ = _gql(
                self._app,
                self._app.admin_secret,
                query=query,
                variables={"experimentId": exp_id, "cursor": cursor},
            )
            node_data = data["data"]["node"]
            runs_data = node_data["runs"]

            all_runs.extend(runs_data["edges"])

            if not runs_data["pageInfo"]["hasNextPage"]:
                break
            cursor = runs_data["pageInfo"]["endCursor"]

        # Return in the same format as before but with all runs
        return {"runs": {"edges": all_runs}}

    @staticmethod
    def assert_annotations(
        runs_data: list[dict[str, Any]],
        expected_count: int,
        expected_by_run: dict[str, float],
    ) -> None:
        """
        Assert annotations match expectations.

        Args:
            runs_data: List of run edges from GraphQL response
            expected_count: Expected number of runs
            expected_by_run: Dict of evaluator_name -> expected_score for each run
        """
        assert len(runs_data) == expected_count, (
            f"Expected {expected_count} runs, got {len(runs_data)}"
        )

        for run_edge in runs_data:
            annotations = run_edge["run"]["annotations"]["edges"]
            annotations_by_name = {
                ann["annotation"]["name"]: ann["annotation"] for ann in annotations
            }

            assert len(annotations_by_name) == len(expected_by_run), (
                f"Expected {len(expected_by_run)} evaluations, got {len(annotations_by_name)}"
            )

            for eval_name, expected_score in expected_by_run.items():
                assert eval_name in annotations_by_name, f"Missing evaluator: {eval_name}"
                annotation = annotations_by_name[eval_name]
                assert annotation["score"] == expected_score, (
                    f"{eval_name}: expected score {expected_score}, got {annotation['score']}"
                )
                assert annotation["error"] is None, (
                    f"{eval_name}: expected no error, got {annotation['error']}"
                )

    def assert_output_by_example(
        self,
        experiment_id: str,
        expected: dict[int, str | list[str | None]],
        examples: list[v1.DatasetExample],
    ) -> None:
        """
        Assert that examples have expected outputs.

        Args:
            experiment_id: The experiment ID
            expected: Dict mapping example index to expected output pattern(s).
                     If str, all repetitions should match that pattern.
                     If list[str | None], each repetition should match corresponding pattern.
                     None values in the list skip validation for that repetition.
            examples: List of dataset examples to get IDs from
        """
        runs = self.get_runs(experiment_id)

        # Group successful runs by example ID
        runs_by_example: dict[str, list[v1.ExperimentRun]] = {}
        for run in runs:
            if not run.get("error"):
                example_id = run["dataset_example_id"]
                runs_by_example.setdefault(example_id, []).append(run)

        # Sort each example's runs by repetition number
        for example_runs in runs_by_example.values():
            example_runs.sort(key=lambda r: r["repetition_number"])

        # Verify expected outputs
        for idx, pattern in expected.items():
            example_id = examples[idx]["id"]
            example_runs = runs_by_example[example_id]

            if isinstance(pattern, str):
                # All repetitions should match this pattern
                for run in example_runs:
                    output = run["output"]
                    rep_num = run["repetition_number"]
                    assert pattern in str(output) or output == pattern, (
                        f"Example {idx} rep {rep_num} should match '{pattern}', got: {output}"
                    )
            elif isinstance(pattern, list):
                # Each repetition should match corresponding pattern
                assert len(example_runs) == len(pattern), (
                    f"Example {idx} has {len(example_runs)} runs, expected {len(pattern)}"
                )
                for run, expected_pattern in zip(example_runs, pattern):
                    if expected_pattern is None:
                        continue  # Skip validation
                    output = run["output"]
                    rep_num = run["repetition_number"]
                    assert expected_pattern in str(output) or output == expected_pattern, (
                        f"Example {idx} rep {rep_num} should match '{expected_pattern}', got: {output}"
                    )

    def clean_up(self) -> None:
        """Delete all datasets created during testing."""
        for dataset_id in self._created_datasets:
            try:
                self.http_client.delete(f"v1/datasets/{dataset_id}")
            except Exception:
                # Silently ignore cleanup errors
                pass


# Type alias for the setup fixture factory function
_SetupExperimentTest = Callable[
    [bool], tuple[Union[AsyncClient, SyncClient], "_ExperimentTestHelper"]
]


@pytest.fixture
def _setup_experiment_test(_app: _AppInfo) -> Iterator[_SetupExperimentTest]:
    """Fixture that returns a factory function for creating test helpers with automatic cleanup."""
    helpers: list[_ExperimentTestHelper] = []

    def _setup(is_async: bool) -> tuple[Union[AsyncClient, SyncClient], _ExperimentTestHelper]:
        Client = AsyncClient if is_async else SyncClient
        client = Client(base_url=_app.base_url, api_key=_app.admin_secret)
        helper = _ExperimentTestHelper(_app)
        helpers.append(helper)
        return client, helper

    yield _setup

    # Cleanup all helpers created during the test
    for helper in helpers:
        helper.clean_up()


class SpanCapture:
    """Helper class to capture OpenTelemetry spans during testing."""

    def __init__(self) -> None:
        self.spans: list[ReadableSpan] = []

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
    async def test_run_experiment_basic(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_experiment_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                experiment_name=f"test_experiment_{token_hex(4)}",
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
        _app: _AppInfo,
    ) -> None:
        """Test that experiments create proper OpenTelemetry spans with correct attributes."""
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_span_creation_{token_hex(4)}"

        # Create a small dataset for testing
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
                Client(
                    base_url=_app.base_url, api_key=_app.admin_secret
                ).experiments.run_experiment(
                    dataset=dataset,
                    task=classification_task,
                    evaluators={"accuracy_evaluator": accuracy_evaluator},
                    experiment_name=f"test_span_experiment_{token_hex(4)}",
                    print_summary=False,
                )
            )

        assert len(result["task_runs"]) == 2
        assert len(result["evaluation_runs"]) == 2

        assert len(span_capture.spans) > 0, "No spans were captured"

        task_spans: list[ReadableSpan] = []
        eval_spans: list[ReadableSpan] = []

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
            span_context = span.get_span_context()  # type: ignore[no-untyped-call]
            if span_context is not None:
                assert span_context.trace_id != 0, "Span should have a valid trace ID"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_with_evaluators(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_experiment_eval_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=classification_task,
                evaluators=[accuracy_evaluator, length_evaluator],
                experiment_name=f"test_eval_experiment_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 2
        assert len(result["evaluation_runs"]) > 0

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_with_different_task_signatures(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_signatures_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=task_with_input_only,
                experiment_name=f"test_input_only_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result1["task_runs"]) == 1

        result2 = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=task_with_multiple_params,
                experiment_name=f"test_multi_params_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result2["task_runs"]) == 1

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_dry_run(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_dry_run_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
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
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
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
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_metadata_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                experiment_name=f"test_with_metadata_{token_hex(4)}",
                experiment_description="Experiment with metadata",
                experiment_metadata=experiment_metadata,
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 1

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_task_and_evaluator_parameter_isolation(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from phoenix.client.resources.experiments.types import ExampleProxy

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_copying_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "Hello"}],
                outputs=[{"expected": "greeting"}],
                metadata=[{"category": "test"}],
            )
        )

        def mutating_task(
            input: Dict[str, Any],
            expected: Dict[str, Any],
            metadata: Dict[str, Any],
            example: Any,
        ) -> str:
            input["added_by_task"] = True
            expected["added_by_task"] = True
            metadata["added_by_task"] = True
            return "ok"

        observations: Dict[str, Any] = {
            "task_example_is_proxy": None,
            "task_example_has_id": None,
            "task_example_input_text": None,
            "ev1_input_had_task": None,
            "ev1_expected_had_task": None,
            "ev1_metadata_had_task": None,
            "ev1_example_is_proxy": None,
            "ev1_example_has_id": None,
            "ev2_input_had_ev1": None,
            "ev2_expected_had_ev1": None,
            "ev2_metadata_had_ev1": None,
            "ev2_example_is_proxy": None,
            "ev2_example_has_id": None,
        }

        def evaluator_one(
            input: Dict[str, Any],
            expected: Dict[str, Any],
            metadata: Dict[str, Any],
            example: Any,
        ) -> float:
            observations["ev1_input_had_task"] = "added_by_task" in input
            observations["ev1_expected_had_task"] = "added_by_task" in expected
            observations["ev1_metadata_had_task"] = "added_by_task" in metadata
            observations["ev1_example_is_proxy"] = isinstance(example, ExampleProxy)
            observations["ev1_example_has_id"] = bool(example.get("id"))
            input["added_by_ev1"] = True
            expected["added_by_ev1"] = True
            metadata["added_by_ev1"] = True
            return 1.0

        def evaluator_two(
            input: Dict[str, Any],
            expected: Dict[str, Any],
            metadata: Dict[str, Any],
            example: Any,
        ) -> float:
            observations["ev2_input_had_ev1"] = "added_by_ev1" in input
            observations["ev2_expected_had_ev1"] = "added_by_ev1" in expected
            observations["ev2_metadata_had_ev1"] = "added_by_ev1" in metadata
            observations["ev2_example_is_proxy"] = isinstance(example, ExampleProxy)
            observations["ev2_example_has_id"] = bool(example.get("id"))
            return 1.0

        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=mutating_task,
                evaluators=[evaluator_one, evaluator_two],
                experiment_name=f"test_copying_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 1
        assert len(result["evaluation_runs"]) == 2

        assert observations["ev1_input_had_task"] is False
        assert observations["ev1_expected_had_task"] is False
        assert observations["ev1_metadata_had_task"] is False

        assert observations["ev2_input_had_ev1"] is False
        assert observations["ev2_expected_had_ev1"] is False
        assert observations["ev2_metadata_had_ev1"] is False

        assert observations["ev1_example_is_proxy"] is True
        assert observations["ev1_example_has_id"] is True

        assert observations["ev2_example_is_proxy"] is True
        assert observations["ev2_example_has_id"] is True

        original_example = next(iter(dataset.examples))
        assert "added_by_task" not in original_example["input"]
        assert "added_by_ev1" not in original_example["input"]

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_example_proxy_properties(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from phoenix.client.resources.experiments.types import ExampleProxy

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_example_proxy_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
                name=unique_name,
                inputs=[{"question": "What is 2+2?"}],
                outputs=[{"answer": "4"}],
                metadata=[{"difficulty": "easy"}],
            )
        )

        observations: Dict[str, Any] = {}

        def example_inspector(example: Any) -> str:
            observations["is_example_proxy"] = isinstance(example, ExampleProxy)
            observations["has_id_property"] = hasattr(example, "id")
            observations["has_input_property"] = hasattr(example, "input")
            observations["has_output_property"] = hasattr(example, "output")
            observations["has_metadata_property"] = hasattr(example, "metadata")
            observations["has_updated_at_property"] = hasattr(example, "updated_at")

            observations["id_value"] = example.id if hasattr(example, "id") else None
            observations["input_value"] = dict(example.input) if hasattr(example, "input") else None
            observations["output_value"] = (
                dict(example.output) if hasattr(example, "output") else None
            )
            observations["metadata_value"] = (
                dict(example.metadata) if hasattr(example, "metadata") else None
            )

            observations["dict_access_id"] = example.get("id")
            observations["dict_access_input"] = example.get("input")

            observations["supports_iteration"] = (
                list(example.keys()) if hasattr(example, "keys") else None
            )

            return "ok"

        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=example_inspector,
                experiment_name=f"test_proxy_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 1

        assert observations["is_example_proxy"] is True
        assert observations["has_id_property"] is True
        assert observations["has_input_property"] is True
        assert observations["has_output_property"] is True
        assert observations["has_metadata_property"] is True
        assert observations["has_updated_at_property"] is True

        assert observations["id_value"] is not None
        assert observations["input_value"] == {"question": "What is 2+2?"}
        assert observations["output_value"] == {"answer": "4"}
        assert observations["metadata_value"] == {"difficulty": "easy"}

        assert observations["dict_access_id"] is not None
        assert observations["dict_access_input"] == {"question": "What is 2+2?"}

        assert observations["supports_iteration"] is not None
        assert "id" in observations["supports_iteration"]
        assert "input" in observations["supports_iteration"]

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_evaluator_types(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_eval_types_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                evaluators={
                    "bool_eval": bool_evaluator,
                    "float_eval": float_evaluator,
                    "tuple_eval": tuple_evaluator,
                    "dict_eval": dict_evaluator,
                },
                experiment_name=f"test_eval_types_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 1
        assert len(result["evaluation_runs"]) > 0

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_async_task(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        if not is_async:
            pytest.skip("Async tasks only supported with AsyncClient")

        from phoenix.client import AsyncClient

        unique_name = f"test_async_task_{token_hex(4)}"

        dataset: Dataset = await _await_or_return(
            AsyncClient(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "Async test"}],
                outputs=[{"expected": "async_result"}],
            )
        )

        async def async_task(input: Dict[str, Any]) -> str:
            await asyncio.sleep(0.1)
            return f"async_processed_{input.get('text', '')}"

        result = await AsyncClient(
            base_url=_app.base_url, api_key=_app.admin_secret
        ).experiments.run_experiment(
            dataset=dataset,
            task=async_task,
            experiment_name=f"test_async_{token_hex(4)}",
            print_summary=False,
        )

        assert len(result["task_runs"]) == 1
        assert "async_processed_" in result["task_runs"][0]["output"]

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_error_handling(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_error_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "test"}],
                outputs=[{"expected": "result"}],
            )
        )

        def failing_task(input: Dict[str, Any]) -> str:
            raise ValueError("Task failed intentionally")

        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=failing_task,
                experiment_name=f"test_error_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 1
        assert "error" in result["task_runs"][0] or result["task_runs"][0]["output"] is None

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_experiment_with_empty_dataset(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_empty_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
                name=unique_name,
                inputs=[{"placeholder": "temp"}],
                outputs=[{"placeholder": "temp"}],
            )
        )

        original_dataset_id = dataset.id
        original_version_id = dataset.version_id

        dataset._examples_data = v1.ListDatasetExamplesData(
            dataset_id=original_dataset_id,
            version_id=original_version_id,
            filtered_splits=[],
            examples=[],
        )

        def simple_task(input: Dict[str, Any]) -> str:
            return "test"

        with pytest.raises(ValueError, match="Dataset has no examples"):
            await _await_or_return(
                Client(
                    base_url=_app.base_url, api_key=_app.admin_secret
                ).experiments.run_experiment(
                    dataset=dataset,  # pyright: ignore[reportArgumentType]
                    task=simple_task,
                    experiment_name="test_empty",
                    print_summary=False,
                )
            )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_evaluator_dynamic_parameter_binding(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_eval_params_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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

        def example_evaluator(example: Dict[str, Any]) -> Dict[str, Any]:
            has_id = bool(example.get("id"))
            has_input = isinstance(example.get("input"), dict)
            return {
                "score": 1.0 if has_id and has_input else 0.0,
                "label": "has_example",
            }

        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=question_answering_task,
                evaluators={
                    "output_only": output_only_evaluator,
                    "relevance": accuracy_evaluator,
                    "comprehensive": comprehensive_evaluator,
                    "reference": reference_evaluator,
                    "metadata": metadata_evaluator,
                    "example": example_evaluator,
                },
                experiment_name=f"test_param_binding_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result["task_runs"]) == 2
        assert len(result["evaluation_runs"]) == 12  # 2 examples * 6 evaluators

        comprehensive_evals = [
            eval_run for eval_run in result["evaluation_runs"] if eval_run.name == "comprehensive"
        ]
        assert len(comprehensive_evals) == 2

        for eval_run in comprehensive_evals:
            assert eval_run.result is not None
            assert isinstance(eval_run.result, dict)
            assert eval_run.result.get("score") == 1.0
            assert "comprehensive_check" in (eval_run.result.get("label") or "")

        reference_evals = [
            eval_run for eval_run in result["evaluation_runs"] if eval_run.name == "reference"
        ]
        assert len(reference_evals) == 2

        for eval_run in reference_evals:
            assert eval_run.result is not None
            assert isinstance(eval_run.result, dict)
            assert eval_run.result.get("score") == 1.0

        metadata_evals = [
            eval_run for eval_run in result["evaluation_runs"] if eval_run.name == "metadata"
        ]
        assert len(metadata_evals) == 2

        for eval_run in metadata_evals:
            assert eval_run.result is not None
            assert isinstance(eval_run.result, dict)
            assert eval_run.result.get("score") is not None
            assert eval_run.result.get("label") is not None
            assert eval_run.result.get("explanation") is not None

        example_evals = [
            eval_run for eval_run in result["evaluation_runs"] if eval_run.name == "example"
        ]
        assert len(example_evals) == 2
        for eval_run in example_evals:
            assert eval_run.result is not None
            assert isinstance(eval_run.result, dict)
            assert eval_run.result.get("score") == 1.0
            assert eval_run.result.get("label") == "has_example"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_task_dynamic_parameter_binding(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_task_params_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=input_only_task,
                experiment_name=f"test_input_only_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result1["task_runs"]) == 2
        for task_run in result1["task_runs"]:
            assert "Processing:" in task_run["output"]

        result2 = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=input_expected_task,
                experiment_name=f"test_input_expected_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result2["task_runs"]) == 2
        for task_run in result2["task_runs"]:
            assert "Question:" in task_run["output"]
            assert "Expected:" in task_run["output"]

        result3 = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=reference_task,
                experiment_name=f"test_reference_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result3["task_runs"]) == 2
        for task_run in result3["task_runs"]:
            assert "Q:" in task_run["output"]
            assert "Ref:" in task_run["output"]

        result4 = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=metadata_task,
                experiment_name=f"test_metadata_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert len(result4["task_runs"]) == 2
        for task_run in result4["task_runs"]:
            assert "Difficulty:" in task_run["output"]
            assert "Category:" in task_run["output"]

        result5 = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=comprehensive_task,
                experiment_name=f"test_comprehensive_{token_hex(4)}",
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

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_get_experiment(
        self,
        is_async: bool,
        _app: _AppInfo,
        _setup_experiment_test: _SetupExperimentTest,
    ) -> None:
        """Test getting a single experiment by ID."""
        client, helper = _setup_experiment_test(is_async)

        # Create a dataset, experiment, and run
        dataset_id, examples = helper.create_dataset(
            inputs=[{"q": "test"}],
            outputs=[{"a": "answer"}],
        )
        exp = helper.create_experiment(dataset_id, repetitions=1)
        helper.create_runs(exp["id"], [(examples[0]["id"], 1, "response", None)])

        # Test get method
        retrieved = await _await_or_return(client.experiments.get(experiment_id=exp["id"]))

        assert retrieved["id"] == exp["id"]
        assert retrieved["dataset_id"] == dataset_id
        assert retrieved["repetitions"] == 1
        assert retrieved["example_count"] == 1
        assert retrieved["successful_run_count"] == 1
        assert "created_at" in retrieved
        assert "updated_at" in retrieved

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_get_experiment_not_found(
        self,
        is_async: bool,
        _app: _AppInfo,
        _setup_experiment_test: _SetupExperimentTest,
    ) -> None:
        """Test that getting a non-existent experiment raises ValueError."""
        client, _ = _setup_experiment_test(is_async)

        fake_id = str(GlobalID("Experiment", "999999"))

        with pytest.raises(ValueError, match="Experiment not found"):
            await _await_or_return(client.experiments.get(experiment_id=fake_id))

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_list_experiments(
        self,
        is_async: bool,
        _app: _AppInfo,
        _setup_experiment_test: _SetupExperimentTest,
    ) -> None:
        """Test listing experiments for a dataset."""
        client, helper = _setup_experiment_test(is_async)

        # Create a dataset
        dataset_id, examples = helper.create_dataset(
            inputs=[{"q": f"test{i}"} for i in range(3)],
            outputs=[{"a": f"answer{i}"} for i in range(3)],
        )

        # Create multiple experiments with runs
        exp_ids: list[str] = []
        for i in range(3):
            exp = helper.create_experiment(dataset_id, repetitions=1)
            # Create runs for all examples in one call
            runs: list[tuple[str, int, Optional[str], Optional[str]]] = [
                (ex["id"], 1, f"response_{i}", None) for ex in examples
            ]
            helper.create_runs(exp["id"], runs)
            exp_ids.append(exp["id"])

        # List experiments
        experiments = await _await_or_return(client.experiments.list(dataset_id=dataset_id))

        assert len(experiments) == 3
        for exp in experiments:
            assert exp["dataset_id"] == dataset_id
            assert exp["example_count"] == 3
            assert exp["successful_run_count"] == 3
            assert "id" in exp
            assert "created_at" in exp
            assert "updated_at" in exp

        # Verify all created experiments are in the list
        retrieved_ids = [exp["id"] for exp in experiments]
        for exp_id in exp_ids:
            assert exp_id in retrieved_ids

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_list_experiments_empty(
        self,
        is_async: bool,
        _app: _AppInfo,
        _setup_experiment_test: _SetupExperimentTest,
    ) -> None:
        """Test listing experiments for a dataset with no experiments."""
        client, helper = _setup_experiment_test(is_async)

        # Create a dataset with no experiments
        dataset_id, _ = helper.create_dataset(
            inputs=[{"q": "test"}],
            outputs=[{"a": "answer"}],
        )

        # List experiments
        experiments = await _await_or_return(client.experiments.list(dataset_id=dataset_id))

        assert len(experiments) == 0

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_list_experiments_pagination(
        self,
        is_async: bool,
        _app: _AppInfo,
        _setup_experiment_test: _SetupExperimentTest,
    ) -> None:
        """Test that list_experiments supports cursor-based pagination."""
        client, helper = _setup_experiment_test(is_async)

        # Create a dataset
        dataset_id, _ = helper.create_dataset(
            inputs=[{"q": "test"}],
            outputs=[{"a": "answer"}],
        )

        # Create multiple experiments (6 experiments)
        experiment_ids: list[str] = []
        for _ in range(6):
            exp = helper.create_experiment(dataset_id, repetitions=1)
            experiment_ids.append(exp["id"])

        # Test manual pagination with HTTP client directly to debug
        all_paginated_ids: list[str] = []
        cursor = None
        page_count = 0

        while True:
            page_count += 1
            params: dict[str, Any] = {"limit": 2}
            if cursor:
                params["cursor"] = cursor

            resp = helper.http_client.get(f"v1/datasets/{dataset_id}/experiments", params=params)
            resp.raise_for_status()
            page_data = resp.json()

            all_paginated_ids.extend([cast(str, exp["id"]) for exp in page_data["data"]])

            # Verify page size (should be 2 except possibly the last page)
            assert len(page_data["data"]) <= 2

            cursor = page_data.get("next_cursor")
            if not cursor:
                break

            # Safety check to prevent infinite loop
            assert page_count <= 10, "Pagination took too many pages"

        # Verify we got all experiments
        assert len(all_paginated_ids) == 6
        assert set(all_paginated_ids) == set(experiment_ids)

        # Verify automatic pagination with list() gets all experiments
        all_experiments = await _await_or_return(client.experiments.list(dataset_id=dataset_id))
        assert len(all_experiments) == 6
        assert set(exp["id"] for exp in all_experiments) == set(experiment_ids)

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_delete_experiment(
        self,
        is_async: bool,
        _app: _AppInfo,
        _setup_experiment_test: _SetupExperimentTest,
    ) -> None:
        """Test deleting an experiment."""
        client, helper = _setup_experiment_test(is_async)

        # Create a dataset, experiment, and run
        dataset_id, examples = helper.create_dataset(
            inputs=[{"q": "test"}],
            outputs=[{"a": "answer"}],
        )
        exp = helper.create_experiment(dataset_id, repetitions=1)
        helper.create_runs(exp["id"], [(examples[0]["id"], 1, "response", None)])

        # Delete the experiment
        await _await_or_return(client.experiments.delete(experiment_id=exp["id"]))

        # Verify experiment no longer exists
        with pytest.raises(ValueError, match="Experiment not found"):
            await _await_or_return(client.experiments.get(experiment_id=exp["id"]))

        # Verify it's not in the list
        experiments = await _await_or_return(client.experiments.list(dataset_id=dataset_id))
        experiment_ids = [exp["id"] for exp in experiments]
        assert exp["id"] not in experiment_ids

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_delete_experiment_not_found(
        self,
        is_async: bool,
        _app: _AppInfo,
        _setup_experiment_test: _SetupExperimentTest,
    ) -> None:
        """Test that deleting a non-existent experiment raises ValueError."""
        client, _ = _setup_experiment_test(is_async)

        fake_id = str(GlobalID("Experiment", "999999"))

        with pytest.raises(ValueError, match="Experiment not found"):
            await _await_or_return(client.experiments.delete(experiment_id=fake_id))

    async def test_experiment_run_upsert_protection(
        self,
        _app: _AppInfo,
        _setup_experiment_test: _SetupExperimentTest,
    ) -> None:
        """
        Test that experiment runs with successful results cannot be overwritten.

        Verifies:
        1. Successful runs (error=None) return 409 Conflict when update is attempted
        2. Failed runs (error not None) can be updated with new errors
        3. Failed runs can be updated to successful runs
        4. Once updated to successful, runs become protected from further updates
        """
        _, helper = _setup_experiment_test(False)

        # Create dataset and experiment
        dataset_id, examples = helper.create_dataset(
            inputs=[{"q": "test1"}, {"q": "test2"}],
            outputs=[{"a": "answer1"}, {"a": "answer2"}],
        )
        exp = helper.create_experiment(dataset_id, repetitions=1)

        # Test 1: Create a successful run (error=None)
        successful_run = helper.create_runs(
            exp["id"], [(examples[0]["id"], 1, "original_output", None)]
        )[0]
        assert successful_run["id"] is not None

        # Test 2: Attempt to update the successful run - should return 409
        response = helper.http_client.post(
            f"v1/experiments/{exp['id']}/runs",
            json={
                "dataset_example_id": examples[0]["id"],
                "repetition_number": 1,
                "output": "updated_output",
                "error": None,
                "start_time": helper.now,
                "end_time": helper.now,
            },
        )
        assert response.status_code == 409
        assert "already exists with a successful result" in response.text

        # Test 3: Create a failed run (error not None)
        failed_run = helper.create_runs(
            exp["id"], [(examples[1]["id"], 1, "failed_output", "Some error")]
        )[0]
        assert failed_run["id"] is not None

        # Verify the failed run was created with the error
        runs = helper.get_runs(exp["id"])
        example1_runs = [r for r in runs if r["dataset_example_id"] == examples[1]["id"]]
        assert len(example1_runs) == 1
        assert example1_runs[0]["output"] == "failed_output"
        assert example1_runs[0].get("error") == "Some error"

        # Test 4: Update the failed run with a new error - should succeed
        updated_run = helper.create_runs(
            exp["id"], [(examples[1]["id"], 1, "retried_output", "New error message")]
        )[0]
        assert updated_run["id"] is not None

        # Verify the error was updated
        runs = helper.get_runs(exp["id"])
        example1_runs = [r for r in runs if r["dataset_example_id"] == examples[1]["id"]]
        assert len(example1_runs) == 1
        assert example1_runs[0]["output"] == "retried_output"
        assert example1_runs[0].get("error") == "New error message"

        # Test 5: Update the failed run to successful - should succeed
        successful_retry = helper.create_runs(
            exp["id"], [(examples[1]["id"], 1, "final_output", None)]
        )[0]
        assert successful_retry["id"] is not None

        # Verify the run is now successful (error is None)
        runs = helper.get_runs(exp["id"])
        example1_runs = [r for r in runs if r["dataset_example_id"] == examples[1]["id"]]
        assert len(example1_runs) == 1
        assert example1_runs[0]["output"] == "final_output"
        assert example1_runs[0].get("error") is None

        # Test 6: Now the previously-failed run is successful, it should be protected
        response = helper.http_client.post(
            f"v1/experiments/{exp['id']}/runs",
            json={
                "dataset_example_id": examples[1]["id"],
                "repetition_number": 1,
                "output": "another_attempt",
                "error": None,
                "start_time": helper.now,
                "end_time": helper.now,
            },
        )
        assert response.status_code == 409

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_create_experiment(
        self,
        is_async: bool,
        _app: _AppInfo,
        _setup_experiment_test: _SetupExperimentTest,
    ) -> None:
        """Test creating an experiment without running it."""
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        from .._helpers import _gql

        Client = AsyncClient if is_async else SyncClient
        client = Client(base_url=_app.base_url, api_key=_app.admin_secret)

        unique_name = f"test_create_{token_hex(4)}"

        # Create dataset with 4 examples
        dataset = await _await_or_return(
            client.datasets.create_dataset(
                name=unique_name,
                inputs=[{"q": f"test{i}"} for i in range(4)],
                outputs=[{"a": f"answer{i}"} for i in range(4)],
            )
        )

        example_ids = [example["id"] for example in dataset.examples]

        # Create a split with first 2 examples
        split_mutation = """
            mutation($input: CreateDatasetSplitWithExamplesInput!) {
                createDatasetSplitWithExamples(input: $input) {
                    datasetSplit {
                        id
                        name
                    }
                }
            }
        """

        split_name = f"{unique_name}_train"
        _gql(
            _app,
            _app.admin_secret,
            query=split_mutation,
            variables={
                "input": {
                    "name": split_name,
                    "color": "#FF0000",
                    "exampleIds": [example_ids[0], example_ids[1]],
                }
            },
        )

        # Create experiment with metadata and splits
        experiment = await _await_or_return(
            client.experiments.create(
                dataset_id=dataset.id,
                experiment_name=f"Test Create {token_hex(4)}",
                experiment_description="Test description",
                experiment_metadata={"model": "test"},
                splits=[split_name],
                repetitions=3,
            )
        )

        assert experiment["id"] is not None
        assert experiment["dataset_id"] == dataset.id
        assert experiment["missing_run_count"] == 6  # 2 examples * 3 repetitions
        assert experiment["example_count"] == 2  # Only 2 examples in the split
        assert experiment["metadata"] == {"model": "test"}


class TestResumeOperations:
    """
    Comprehensive test suite for resume operations (resume_experiment and resume_evaluation).

    resume_experiment: Re-runs incomplete or failed experiment task runs.
    resume_evaluation: Re-runs incomplete or failed experiment evaluations.

    Both operations support:
    - Recovering from transient failures
    - Completing partially completed experiments
    - Early exit optimizations

    Tests cover:
    **resume_experiment:**
    - Failed task runs recovery
    - Missing runs (never created)
    - Mixed failed and missing scenarios
    - Repetition-level granularity
    - Error handling and validation

    **resume_evaluation:**
    - Missing evaluations (never run)
    - Failed evaluations (ran but had errors)
    - Successful evaluations (should not be re-run)
    - Early exit when all complete
    """

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_resume_incomplete_runs_comprehensive(
        self, is_async: bool, _app: _AppInfo, _setup_experiment_test: _SetupExperimentTest
    ) -> None:
        """
        Comprehensive test for resuming incomplete runs.

        Tests all incomplete run scenarios in one test:
        1. Failed runs are resumed (examples 0-1)
        2. Successful runs are preserved (example 2)
        3. Missing runs are created (examples 3-4)
        4. Mixed failed+missing work together (examples 0-4)
        5. Repetition-level granularity (example 5: only failed rep 2)

        This consolidates test_basic_resume, test_missing_runs,
        test_mixed_missing_and_failed, and test_repetition_level_granularity.
        """
        client, helper = _setup_experiment_test(is_async)

        # Create first dataset for comprehensive mixed scenarios (examples 0-4)
        dataset_id_1, examples_1 = helper.create_dataset(
            inputs=[{"idx": i} for i in range(5)],
            outputs=[{"result": i} for i in range(5)],
        )

        # Create second dataset for repetition-level granularity test (example 5)
        dataset_id_2, examples_2 = helper.create_dataset(
            inputs=[{"idx": 5}],
            outputs=[{"result": 5}],
        )

        # Experiment 1: Examples 0-4 with 2 repetitions each
        exp = helper.create_experiment(dataset_id_1, repetitions=2)
        helper.create_runs(
            exp["id"],
            [
                # Example 0: failed runs (both reps)
                (examples_1[0]["id"], 1, None, "Failed 0"),
                (examples_1[0]["id"], 2, None, "Failed 0"),
                # Example 1: failed runs (both reps)
                (examples_1[1]["id"], 1, None, "Failed 1"),
                (examples_1[1]["id"], 2, None, "Failed 1"),
                # Example 2: successful runs (will be preserved)
                (examples_1[2]["id"], 1, "Success 2", None),
                (examples_1[2]["id"], 2, "Success 2", None),
                # Examples 3-4: missing runs (not created, but should exist per repetitions=2)
            ],
        )

        # Experiment 2: Example 5 with 3 repetitions (repetition-level test)
        exp_reps = helper.create_experiment(dataset_id_2, repetitions=3)
        helper.create_runs(
            exp_reps["id"],
            [
                (examples_2[0]["id"], 1, "Success rep 1", None),
                (examples_2[0]["id"], 2, None, "Failed rep 2"),
                (examples_2[0]["id"], 3, "Success rep 3", None),
            ],
        )

        # Track execution
        processed: set[int] = set()
        call_count = [0]

        def tracking_task(input: dict[str, Any]) -> str:
            idx = cast(int, input["idx"])
            processed.add(idx)
            call_count[0] += 1
            return f"Resumed {idx}"

        # Resume experiment 1 (examples 0-4)
        await _await_or_return(
            client.experiments.resume_experiment(
                experiment_id=exp["id"],
                task=tracking_task,
                print_summary=False,
            )
        )

        # Verify experiment has correct counts after resuming
        # 5 examples × 2 repetitions = 10 runs total
        resumed_exp = await _await_or_return(client.experiments.get(experiment_id=exp["id"]))
        assert resumed_exp["successful_run_count"] == 10
        assert {0, 1, 3, 4} <= processed, "Should process failed and missing examples"

        # Verify outputs
        helper.assert_output_by_example(
            exp["id"],
            expected={
                0: "Resumed 0",  # Failed → resumed (both reps)
                1: "Resumed 1",  # Failed → resumed (both reps)
                2: "Success 2",  # Successful → preserved (both reps)
                3: "Resumed 3",  # Missing → created (both reps)
                4: "Resumed 4",  # Missing → created (both reps)
            },
            examples=examples_1,
        )

        # Resume experiment 2 (example 5 with repetitions)
        call_count[0] = 0  # Reset counter
        await _await_or_return(
            client.experiments.resume_experiment(
                experiment_id=exp_reps["id"],
                task=tracking_task,
                print_summary=False,
            )
        )

        # Verify only 1 repetition was re-run
        assert call_count[0] == 1, "Should only re-run 1 failed repetition"
        assert 5 in processed

        # Verify repetition-level precision
        helper.assert_output_by_example(
            exp_reps["id"],
            expected={
                0: ["Success rep 1", "Resumed 5", "Success rep 3"],
            },
            examples=examples_2,
        )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_early_exit_when_complete(
        self, is_async: bool, _app: _AppInfo, _setup_experiment_test: _SetupExperimentTest
    ) -> None:
        """
        Test early exit optimization when all runs/evaluations are complete.

        Tests:
        1. resume_experiment early exit when all task runs are successful
        2. resume_evaluation early exit when all evaluations are complete

        Verifies that both operations detect when there's nothing to do and
        skip unnecessary function calls (optimization).
        """
        client, helper = _setup_experiment_test(is_async)

        # Scenario 1: resume_experiment early exit
        dataset_id, examples = helper.create_dataset(
            inputs=[{"q": "Q1"}],
            outputs=[{"a": "A1"}],
        )
        exp = helper.create_experiment(dataset_id, repetitions=1)
        helper.create_runs(exp["id"], [(examples[0]["id"], 1, "Complete", None)])

        task_call_count = [0]

        def noop_task(input: dict[str, Any]) -> str:
            task_call_count[0] += 1
            return "Result"

        await _await_or_return(
            client.experiments.resume_experiment(
                experiment_id=exp["id"],
                task=noop_task,
                print_summary=False,
            )
        )

        assert task_call_count[0] == 0, "Task should not be called when no incomplete runs"
        # Verify experiment state after early exit
        resumed_exp = await _await_or_return(client.experiments.get(experiment_id=exp["id"]))
        assert resumed_exp["id"] == exp["id"]
        assert resumed_exp["example_count"] == 1
        assert resumed_exp["successful_run_count"] == 1

        # Scenario 2: resume_evaluation early exit
        # Add successful evaluation for "relevance"
        helper.create_evaluations(exp["id"], ["relevance"], [])

        eval_call_count = [0]

        def accuracy_evaluator(output: Any) -> float:
            eval_call_count[0] += 1
            return 1.0

        # Try to resume with same evaluator (should early exit, no re-run)
        await _await_or_return(
            client.experiments.resume_evaluation(
                experiment_id=exp["id"],
                evaluators={"relevance": accuracy_evaluator},  # pyright: ignore[reportUnknownLambdaType,reportUnknownArgumentType]
                print_summary=False,
            )
        )

        assert eval_call_count[0] == 0, "Evaluator should not be called when evaluation is complete"

        # Verify the existing evaluation was not modified
        data = helper.get_experiment_annotations(exp["id"])
        helper.assert_annotations(
            runs_data=data["runs"]["edges"],
            expected_count=1,
            expected_by_run={"relevance": 1.0},
        )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_error_scenarios(
        self, is_async: bool, _app: _AppInfo, _setup_experiment_test: _SetupExperimentTest
    ) -> None:
        """
        Comprehensive error handling test covering multiple error scenarios.

        Tests:
        1. Resume task continues to fail - new error is recorded
        2. Resume evaluation continues to fail - new error is recorded
        3. Invalid experiment ID (non-existent ID)
        4. Empty evaluators dict for resume_evaluation

        Verifies that all error conditions are handled gracefully with appropriate
        error messages and the system remains stable.
        """
        client, helper = _setup_experiment_test(is_async)

        # Scenario 1: Resume task continues to fail
        dataset_id, examples = helper.create_dataset(
            inputs=[{"x": i} for i in range(3)],
            outputs=[{"y": i} for i in range(3)],
        )
        exp = helper.create_experiment(dataset_id, repetitions=1)
        helper.create_runs(
            exp["id"], [(examples[i]["id"], 1, None, "Original error") for i in range(3)]
        )

        def failing_task(input: dict[str, Any]) -> str:
            raise ValueError("Task still fails on resume")

        await _await_or_return(
            client.experiments.resume_experiment(
                experiment_id=exp["id"],
                task=failing_task,
                print_summary=False,
            )
        )

        # Verify NEW errors are recorded in the runs (not the original errors)
        runs = helper.get_runs(exp["id"])
        assert len([r for r in runs if r.get("error")]) == 3, "All runs should still have errors"
        for run in runs:
            error_msg = run.get("error", "")
            assert "Task still fails on resume" in error_msg, (
                f"Expected new error message, got: {error_msg}"
            )
            assert "Original error" not in error_msg, "Should have new error, not original"

        # Scenario 2: Resume evaluation continues to fail
        exp2 = helper.create_experiment(dataset_id, repetitions=1)
        helper.create_runs(
            exp2["id"], [(examples[i]["id"], 1, f"output_{i}", None) for i in range(3)]
        )
        # Add failed evaluations
        helper.create_evaluations(exp2["id"], [], ["quality"])

        def failing_evaluator(output: Any) -> float:
            raise ValueError("Evaluator still fails on resume")

        await _await_or_return(
            client.experiments.resume_evaluation(
                experiment_id=exp2["id"],
                evaluators={"quality": failing_evaluator},  # pyright: ignore[reportUnknownLambdaType,reportUnknownArgumentType]
                print_summary=False,
            )
        )

        # Verify NEW evaluation errors are recorded
        data = helper.get_experiment_annotations(exp2["id"])
        annotations = data["runs"]["edges"]
        assert len(annotations) == 3, "Should have 3 runs"
        for run_edge in annotations:
            run_annotations = run_edge["run"]["annotations"]["edges"]
            quality_annotations = [
                a["annotation"] for a in run_annotations if a["annotation"]["name"] == "quality"
            ]
            assert len(quality_annotations) == 1, "Should have one quality annotation per run"
            annotation = quality_annotations[0]
            assert annotation["error"] is not None, "Annotation should have error"
            assert "Evaluator still fails on resume" in annotation["error"], (
                f"Expected new evaluation error message, got: {annotation['error']}"
            )

        # Scenario 3: Invalid experiment ID
        with pytest.raises(ValueError, match="Experiment not found"):
            await _await_or_return(
                client.experiments.resume_experiment(
                    experiment_id=str(GlobalID("Experiment", "999999")),
                    task=lambda input: "x",  # pyright: ignore[reportUnknownLambdaType,reportUnknownArgumentType]
                    print_summary=False,
                )
            )

        # Scenario 4: Empty evaluators for resume_evaluation
        with pytest.raises(ValueError, match="Must specify at least one evaluator"):
            await _await_or_return(
                client.experiments.resume_evaluation(
                    experiment_id=exp["id"],
                    evaluators={},  # Empty dict - should fail validation
                    print_summary=False,
                )
            )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_resume_experiment_with_evaluators(
        self, is_async: bool, _app: _AppInfo, _setup_experiment_test: _SetupExperimentTest
    ) -> None:
        """
        Test resume_experiment with evaluators integration.

        Validates that:
        - Task runs are completed first
        - Evaluators are automatically run on completed runs
        - The integration between resume_experiment and resume_evaluation works correctly
        """
        client, helper = _setup_experiment_test(is_async)

        dataset_id, examples = helper.create_dataset(
            inputs=[{"q": f"Q{i}"} for i in range(2)],
            outputs=[{"a": f"A{i}"} for i in range(2)],
        )

        exp = helper.create_experiment(dataset_id, repetitions=1)
        # Create only failed runs
        helper.create_runs(
            exp["id"],
            [
                (examples[0]["id"], 1, None, "Failed 1"),
                (examples[1]["id"], 1, None, "Failed 2"),
            ],
        )

        # Resume with both task and evaluators
        await _await_or_return(
            client.experiments.resume_experiment(
                experiment_id=exp["id"],
                task=lambda input: f"Resumed {cast(str, input['q'])}",  # pyright: ignore[reportUnknownLambdaType,reportUnknownArgumentType]
                evaluators={"quality": lambda output: 0.9},  # pyright: ignore[reportUnknownLambdaType,reportUnknownArgumentType]
                print_summary=False,
            )
        )

        # Verify task runs completed
        resumed_exp = await _await_or_return(client.experiments.get(experiment_id=exp["id"]))
        assert resumed_exp["id"] == exp["id"]
        assert resumed_exp["successful_run_count"] == 2

        # Verify task outputs were persisted
        helper.assert_output_by_example(
            exp["id"],
            expected={
                0: "Resumed Q0",
                1: "Resumed Q1",
            },
            examples=examples,
        )

        # Verify evaluations were run
        data = helper.get_experiment_annotations(exp["id"])
        helper.assert_annotations(
            runs_data=data["runs"]["edges"],
            expected_count=2,
            expected_by_run={"quality": 0.9},
        )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_resume_evaluation_comprehensive(
        self, is_async: bool, _app: _AppInfo, _setup_experiment_test: _SetupExperimentTest
    ) -> None:
        """
        Comprehensive test for resume_evaluation covering all scenarios.

        Tests:
        1. Successful evaluations are NOT re-run (accuracy, relevance preserved)
        2. Failed evaluations ARE re-run (quality re-executed)
        3. Missing evaluations ARE run (toxicity added)
        4. Selective retry: can resume only specific evaluators
        5. Pagination: large experiments with > 50 runs are handled correctly
        6. Call count tracking verifies correct execution

        This provides complete coverage of resume_evaluation logic.
        """
        client, helper = _setup_experiment_test(is_async)

        # Create experiment with 3 runs
        dataset_id, examples = helper.create_dataset(
            inputs=[{"input": f"input_{i}"} for i in range(3)],
            outputs=[{"output": f"output_{i}"} for i in range(3)],
        )
        exp = helper.create_experiment(dataset_id, repetitions=1)
        helper.create_runs(
            exp["id"],
            [(examples[i]["id"], 1, f"result_{i}", None) for i in range(3)],
        )

        # Add evaluations: accuracy and relevance successful, quality failed
        helper.create_evaluations(exp["id"], ["accuracy", "relevance"], ["quality"])

        # Part 1: Selective retry - resume only the failed "quality" evaluator
        # Other successful evaluators (accuracy, relevance) should be preserved
        quality_call_count = [0]

        def quality_evaluator(output: Any) -> float:
            quality_call_count[0] += 1
            return 0.95

        await _await_or_return(
            client.experiments.resume_evaluation(
                experiment_id=exp["id"],
                evaluators={"quality": quality_evaluator},  # pyright: ignore[reportUnknownLambdaType,reportUnknownArgumentType]
                print_summary=False,
            )
        )

        # Verify quality evaluator was called exactly 3 times (once per run)
        assert quality_call_count[0] == 3, "Quality evaluator should run for all 3 runs"

        # Verify all three evaluators are present with correct scores
        data = helper.get_experiment_annotations(exp["id"])
        helper.assert_annotations(
            runs_data=data["runs"]["edges"],
            expected_count=3,
            expected_by_run={
                "accuracy": 1.0,  # Preserved from original successful run
                "quality": 0.95,  # Updated from failed to successful
                "relevance": 1.0,  # Preserved from original successful run
            },
        )

        # Part 2: Add missing evaluator - resume with new "toxicity" evaluator
        toxicity_call_count = [0]

        def toxicity_evaluator(output: Any) -> float:
            toxicity_call_count[0] += 1
            return 0.1

        await _await_or_return(
            client.experiments.resume_evaluation(
                experiment_id=exp["id"],
                evaluators={"toxicity": toxicity_evaluator},  # pyright: ignore[reportUnknownLambdaType,reportUnknownArgumentType]
                print_summary=False,
            )
        )

        # Verify toxicity evaluator was called 3 times (once per run)
        assert toxicity_call_count[0] == 3, "Toxicity evaluator should run for all 3 runs"

        # Verify all four evaluators are now present
        data = helper.get_experiment_annotations(exp["id"])
        helper.assert_annotations(
            runs_data=data["runs"]["edges"],
            expected_count=3,
            expected_by_run={
                "accuracy": 1.0,  # Still preserved
                "quality": 0.95,  # Still updated
                "relevance": 1.0,  # Still preserved
                "toxicity": 0.1,  # Newly added
            },
        )

        # Part 3: Pagination - test with large experiment (>50 runs)
        num_examples = 75
        dataset_id_large, examples_large = helper.create_dataset(
            inputs=[{"x": i} for i in range(num_examples)],
            outputs=[{"y": i * 2} for i in range(num_examples)],
        )

        exp_large = helper.create_experiment(dataset_id_large, repetitions=1)
        helper.create_runs(
            exp_large["id"],
            [(examples_large[i]["id"], 1, f"output_{i}", None) for i in range(num_examples)],
        )

        # All runs are successful but missing "pagination_test" evaluation
        evaluated_indices: set[int] = set()

        def pagination_evaluator(output: Any) -> float:
            # Extract index from output to track which runs were evaluated
            output_str: str
            if isinstance(output, dict) and "task_output" in output:
                output_str = str(output["task_output"])  # pyright: ignore[reportUnknownArgumentType]
            elif isinstance(output, str):
                output_str = output
            else:
                output_str = str(output)  # pyright: ignore[reportUnknownArgumentType]
            idx = int(output_str.split("_")[1])
            evaluated_indices.add(idx)
            return 0.8

        await _await_or_return(
            client.experiments.resume_evaluation(
                experiment_id=exp_large["id"],
                evaluators={"pagination_test": pagination_evaluator},  # pyright: ignore[reportUnknownLambdaType,reportUnknownArgumentType]
                print_summary=False,
            )
        )

        # Verify all runs were evaluated (no skips due to pagination)
        assert evaluated_indices == set(range(num_examples)), (
            f"All {num_examples} runs should be evaluated across pagination boundaries, "
            f"but only {len(evaluated_indices)} were evaluated"
        )

        # Verify evaluations were persisted to the database
        data_large = helper.get_experiment_annotations(exp_large["id"])
        helper.assert_annotations(
            runs_data=data_large["runs"]["edges"],
            expected_count=num_examples,
            expected_by_run={"pagination_test": 0.8},
        )


class TestEvaluateExperiment:
    """Test the run_experiment -> evaluate_experiment pattern from legacy implementation."""

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_run_experiment_then_evaluate_experiment_pattern(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test running experiment without evaluators, then adding evaluations separately."""
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_evaluate_pattern_{token_hex(4)}"

        # Create test dataset
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
            elif "Python" in question:
                return "Guido van Rossum created Python"
            else:
                return "I don't know"

        def accuracy_evaluator(output: str, expected: Dict[str, Any]) -> float:
            expected_answer = expected.get("answer", "")
            return 1.0 if expected_answer in output else 0.0

        def length_evaluator(output: str) -> Dict[str, Any]:
            return {"score": len(output) / 20.0, "label": "length_score"}

        # Step 1: Run experiment WITHOUT evaluators (task execution only)
        initial_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                experiment_name=f"test_initial_{token_hex(4)}",
                print_summary=False,
            )
        )

        # Verify initial result has no evaluations but has task runs
        assert "experiment_id" in initial_result
        assert "dataset_id" in initial_result
        assert "task_runs" in initial_result
        assert "evaluation_runs" in initial_result
        assert initial_result["dataset_id"] == dataset.id
        assert len(initial_result["task_runs"]) == 3
        assert len(initial_result["evaluation_runs"]) == 0  # No evaluations yet

        # Step 2: Add evaluations to the completed experiment
        # This will test the new evaluate_experiment method
        eval_result = await _await_or_return(
            Client(
                base_url=_app.base_url, api_key=_app.admin_secret
            ).experiments.evaluate_experiment(
                experiment=initial_result,
                evaluators=[accuracy_evaluator, length_evaluator],
                print_summary=False,
            )
        )

        # Verify evaluation results
        assert "experiment_id" in eval_result
        assert "dataset_id" in eval_result
        assert "task_runs" in eval_result
        assert "evaluation_runs" in eval_result
        assert eval_result["experiment_id"] == initial_result["experiment_id"]
        assert eval_result["dataset_id"] == dataset.id
        assert len(eval_result["task_runs"]) == 3  # Same task runs as before
        assert len(eval_result["evaluation_runs"]) > 0  # Now we have evaluations

        # Verify that we have evaluations for each task run and each evaluator
        expected_eval_runs = len(eval_result["task_runs"]) * 2  # 2 evaluators
        assert len(eval_result["evaluation_runs"]) == expected_eval_runs

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_evaluation_consistency_when_implemented(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test that run_experiment with evaluators produces same results as separate evaluation."""
        # Test is now enabled since evaluate_experiment is implemented

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_consistency_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "Hello world"}, {"text": "Python is great"}],
                outputs=[{"expected": "greeting"}, {"expected": "programming"}],
            )
        )

        def simple_task(input: Dict[str, Any]) -> str:
            text = input.get("text", "")
            if "Hello" in text:
                return "greeting"
            elif "Python" in text:
                return "programming"
            else:
                return "unknown"

        def accuracy_evaluator(output: str, expected: Dict[str, Any]) -> float:
            return 1.0 if output == expected.get("expected") else 0.0

        client = Client(base_url=_app.base_url, api_key=_app.admin_secret)

        # Method 1: Run experiment with evaluators included
        result_with_evals = await _await_or_return(
            client.experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                evaluators=[accuracy_evaluator],
                experiment_name=f"test_with_evals_{token_hex(4)}",
                print_summary=False,
            )
        )

        # Method 2: Run experiment without evaluators, then evaluate separately
        result_without_evals = await _await_or_return(
            client.experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                experiment_name=f"test_without_evals_{token_hex(4)}",
                print_summary=False,
            )
        )

        eval_result = await _await_or_return(
            client.experiments.evaluate_experiment(
                experiment=result_without_evals,
                evaluators=[accuracy_evaluator],
                print_summary=False,
            )
        )

        # Both methods should produce equivalent results
        assert len(result_with_evals["evaluation_runs"]) == len(eval_result["evaluation_runs"])
        assert len(result_with_evals["task_runs"]) == len(result_without_evals["task_runs"])

        # Evaluation results should be equivalent
        for eval1, eval2 in zip(
            result_with_evals["evaluation_runs"], eval_result["evaluation_runs"]
        ):
            assert eval1.name == eval2.name
            assert eval1.result == eval2.result

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_get_experiment_and_evaluate(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_get_experiment_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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
            expected_answer = expected.get("answer", "")
            return 1.0 if expected_answer in output else 0.0

        def length_evaluator(output: str) -> Dict[str, Any]:
            return {"score": len(output) / 20.0, "label": "length_score"}

        client = Client(base_url=_app.base_url, api_key=_app.admin_secret)

        initial_result = await _await_or_return(
            client.experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                evaluators=[accuracy_evaluator],  # Start with one evaluator
                experiment_name=f"test_get_exp_{token_hex(4)}",
                print_summary=False,
            )
        )

        assert "experiment_id" in initial_result
        assert "dataset_id" in initial_result
        assert "task_runs" in initial_result
        assert "evaluation_runs" in initial_result
        assert len(initial_result["task_runs"]) == 2
        assert len(initial_result["evaluation_runs"]) == 2  # Should have 2 evals (1 per task run)

        initial_accuracy_evals = [
            eval_run
            for eval_run in initial_result["evaluation_runs"]
            if eval_run.name == "accuracy_evaluator"
        ]
        assert len(initial_accuracy_evals) == 2

        retrieved_experiment = await _await_or_return(
            client.experiments.get_experiment(experiment_id=initial_result["experiment_id"])
        )

        assert retrieved_experiment["experiment_id"] == initial_result["experiment_id"]
        assert retrieved_experiment["dataset_id"] == initial_result["dataset_id"]
        assert len(retrieved_experiment["task_runs"]) == len(initial_result["task_runs"])

        assert len(retrieved_experiment["evaluation_runs"]) == len(
            initial_result["evaluation_runs"]
        )
        assert len(retrieved_experiment["evaluation_runs"]) == 2

        retrieved_accuracy_evals = [
            eval_run
            for eval_run in retrieved_experiment["evaluation_runs"]
            if eval_run.name == "accuracy_evaluator"
        ]
        assert len(retrieved_accuracy_evals) == 2

        task_outputs = [run["output"] for run in retrieved_experiment["task_runs"]]
        assert "The answer is 4" in task_outputs
        assert "The capital is Paris" in task_outputs

        final_result = await _await_or_return(
            client.experiments.evaluate_experiment(
                experiment=retrieved_experiment,
                evaluators=[length_evaluator],  # Add a second evaluator
                print_summary=False,
            )
        )

        assert final_result["experiment_id"] == initial_result["experiment_id"]
        assert final_result["dataset_id"] == initial_result["dataset_id"]
        assert len(final_result["task_runs"]) == 2  # Same task runs

        assert len(final_result["evaluation_runs"]) == 4

        final_accuracy_evals = [
            eval_run
            for eval_run in final_result["evaluation_runs"]
            if eval_run.name == "accuracy_evaluator"
        ]
        assert len(final_accuracy_evals) == 2

        final_length_evals = [
            eval_run
            for eval_run in final_result["evaluation_runs"]
            if eval_run.name == "length_evaluator"
        ]
        assert len(final_length_evals) == 2

        # Verify evaluation results
        for eval_run in final_accuracy_evals:
            assert eval_run.result is not None
            assert isinstance(eval_run.result, dict)
            assert eval_run.result.get("score") == 1.0

        for eval_run in final_length_evals:
            assert eval_run.result is not None
            assert isinstance(eval_run.result, dict)
            assert eval_run.result.get("score") is not None
            assert eval_run.result.get("label") == "length_score"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dry_run_with_evaluate_experiment(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_dry_run_eval_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
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

        def simple_task(input: Dict[str, Any]) -> str:
            text = input.get("text", "")
            if "Hello" in text:
                return "greeting"
            elif "Python" in text:
                return "programming"
            else:
                return "unknown"

        def accuracy_evaluator(output: str, expected: Dict[str, Any]) -> float:
            return 1.0 if output == expected.get("expected") else 0.0

        client = Client(base_url=_app.base_url, api_key=_app.admin_secret)

        dry_run_result = await _await_or_return(
            client.experiments.run_experiment(
                dataset=dataset,
                task=simple_task,
                experiment_name=f"test_dry_run_{token_hex(4)}",
                dry_run=True,
                print_summary=False,
            )
        )

        assert dry_run_result["experiment_id"] == "DRY_RUN"
        assert len(dry_run_result["task_runs"]) == 1
        assert len(dry_run_result["evaluation_runs"]) == 0

        eval_result = await _await_or_return(
            client.experiments.evaluate_experiment(
                experiment=dry_run_result,
                evaluators=[accuracy_evaluator],
                dry_run=True,
                print_summary=False,
            )
        )

        assert eval_result["experiment_id"] == "DRY_RUN"
        assert len(eval_result["task_runs"]) == 1
        assert len(eval_result["evaluation_runs"]) == 1

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_experiment_with_dataset_splits(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test that experiments correctly record split_ids and populate the experiments_dataset_splits junction table."""
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        from .._helpers import _gql

        Client = AsyncClient if is_async else SyncClient

        unique_name = f"test_exp_splits_{token_hex(4)}"

        # Create dataset with examples
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"question": "What is 2+2?"},
                    {"question": "What is the capital of France?"},
                    {"question": "Who wrote Python?"},
                    {"question": "What is recursion?"},
                ],
                outputs=[
                    {"answer": "4"},
                    {"answer": "Paris"},
                    {"answer": "Guido van Rossum"},
                    {"answer": "A function calling itself"},
                ],
                metadata=[
                    {"category": "math"},
                    {"category": "geography"},
                    {"category": "programming"},
                    {"category": "computer_science"},
                ],
            )
        )

        assert len(dataset) == 4
        example_ids = [example["id"] for example in dataset.examples]

        # Create splits using GraphQL
        # Split 1: Training set (first 2 examples)
        split_mutation = """
            mutation($input: CreateDatasetSplitWithExamplesInput!) {
                createDatasetSplitWithExamples(input: $input) {
                    datasetSplit {
                        id
                        name
                    }
                }
            }
        """

        train_split_result, _ = _gql(
            _app,
            _app.admin_secret,
            query=split_mutation,
            variables={
                "input": {
                    "name": f"{unique_name}_train",
                    "color": "#FF0000",
                    "exampleIds": [example_ids[0], example_ids[1]],
                }
            },
        )
        train_split_id = train_split_result["data"]["createDatasetSplitWithExamples"][
            "datasetSplit"
        ]["id"]
        train_split_name = train_split_result["data"]["createDatasetSplitWithExamples"][
            "datasetSplit"
        ]["name"]

        # Split 2: Test set (last 2 examples)
        test_split_result, _ = _gql(
            _app,
            _app.admin_secret,
            query=split_mutation,
            variables={
                "input": {
                    "name": f"{unique_name}_test",
                    "color": "#00FF00",
                    "exampleIds": [example_ids[2], example_ids[3]],
                }
            },
        )
        test_split_id = test_split_result["data"]["createDatasetSplitWithExamples"]["datasetSplit"][
            "id"
        ]
        test_split_name = test_split_result["data"]["createDatasetSplitWithExamples"][
            "datasetSplit"
        ]["name"]

        # First, verify that getting dataset with no splits filter returns ALL examples
        full_dataset_no_filter = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.get_dataset(
                dataset=dataset.id
            )
        )
        assert len(full_dataset_no_filter) == 4, (
            f"Expected all 4 examples with no filter, got {len(full_dataset_no_filter)}"
        )
        assert full_dataset_no_filter._filtered_split_names == [], (
            f"Expected empty split_names with no filter, got {full_dataset_no_filter._filtered_split_names}"
        )

        # Verify all original example IDs are present
        full_dataset_example_ids = {example["id"] for example in full_dataset_no_filter.examples}
        assert full_dataset_example_ids == set(example_ids), (
            "Full dataset should contain all original example IDs"
        )

        # Define GraphQL query for verifying experiment splits (used multiple times below)
        verify_splits_query = """
            query($experimentId: ID!) {
                node(id: $experimentId) {
                    ... on Experiment {
                        id
                        datasetSplits {
                            edges {
                                node {
                                    id
                                    name
                                }
                            }
                        }
                    }
                }
            }
        """

        # Define a simple task for the experiment (used in multiple tests below)
        def simple_task(input: Dict[str, Any]) -> str:
            question = input.get("question", "")
            if "2+2" in question:
                return "The answer is 4"
            elif "capital" in question:
                return "The capital is Paris"
            elif "Python" in question:
                return "Created by Guido van Rossum"
            elif "recursion" in question:
                return "When a function calls itself"
            else:
                return "I don't know"

        # Run an experiment on the full dataset (no split filter) to verify it processes all examples
        full_dataset_experiment = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=full_dataset_no_filter,
                task=simple_task,
                experiment_name=f"test_no_split_experiment_{token_hex(4)}",
                experiment_description="Test experiment with no split filter",
                print_summary=False,
            )
        )

        assert len(full_dataset_experiment["task_runs"]) == 4, (
            f"Expected 4 task runs on full dataset, got {len(full_dataset_experiment['task_runs'])}"
        )

        # Verify that experiment with no split filter has empty dataset_splits association
        no_split_exp_id = full_dataset_experiment["experiment_id"]
        no_split_verification, _ = _gql(
            _app,
            _app.admin_secret,
            query=verify_splits_query,
            variables={"experimentId": no_split_exp_id},
        )
        no_split_exp_node = no_split_verification["data"]["node"]
        no_split_edges = no_split_exp_node["datasetSplits"]["edges"]
        assert len(no_split_edges) == 0, (
            f"Expected 0 splits for experiment with no filter, got {len(no_split_edges)}"
        )

        # Get dataset filtered by train split only
        train_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.get_dataset(
                dataset=dataset.id,
                splits=[train_split_name],
            )
        )

        assert len(train_dataset) == 2, (
            f"Expected 2 examples in train split, got {len(train_dataset)}"
        )
        assert train_split_name in train_dataset._filtered_split_names, (
            "Train split name should be in dataset._filtered_split_names"
        )

        # Run experiment on the filtered train dataset
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=train_dataset,
                task=simple_task,
                experiment_name=f"test_split_experiment_{token_hex(4)}",
                experiment_description="Test experiment with dataset splits",
                print_summary=False,
            )
        )

        # Verify experiment was created and ran on correct number of examples
        assert "experiment_id" in result
        assert result["experiment_id"] != "DRY_RUN"
        assert "dataset_id" in result
        assert result["dataset_id"] == dataset.id
        assert len(result["task_runs"]) == 2, (
            f"Expected 2 task runs (train split), got {len(result['task_runs'])}"
        )

        experiment_id = result["experiment_id"]

        # Query the database to verify the experiments_dataset_splits junction table is populated
        splits_verification, _ = _gql(
            _app,
            _app.admin_secret,
            query=verify_splits_query,
            variables={"experimentId": experiment_id},
        )

        experiment_node = splits_verification["data"]["node"]
        assert experiment_node is not None, "Experiment should exist"
        assert "datasetSplits" in experiment_node, "Experiment should have datasetSplits field"

        dataset_splits_edges = experiment_node["datasetSplits"]["edges"]
        assert len(dataset_splits_edges) == 1, (
            f"Expected 1 split associated with experiment, got {len(dataset_splits_edges)}"
        )

        associated_split = dataset_splits_edges[0]["node"]
        assert associated_split["id"] == train_split_id, (
            f"Expected train split {train_split_id}, got {associated_split['id']}"
        )
        assert associated_split["name"] == train_split_name, (
            f"Expected train split name {train_split_name}, got {associated_split['name']}"
        )

        # Test retrieving the experiment and verifying it contains split information
        retrieved_experiment = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.get_experiment(
                experiment_id=experiment_id
            )
        )

        assert retrieved_experiment["experiment_id"] == experiment_id
        assert retrieved_experiment["dataset_id"] == dataset.id
        assert len(retrieved_experiment["task_runs"]) == 2

        # Now test running an experiment on multiple splits
        both_splits_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).datasets.get_dataset(
                dataset=dataset.id,
                splits=[train_split_name, test_split_name],
            )
        )

        assert len(both_splits_dataset) == 4, (
            f"Expected 4 examples with both splits, got {len(both_splits_dataset)}"
        )
        assert train_split_name in both_splits_dataset._filtered_split_names
        assert test_split_name in both_splits_dataset._filtered_split_names

        # Run experiment on dataset with both splits
        multi_split_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).experiments.run_experiment(
                dataset=both_splits_dataset,
                task=simple_task,
                experiment_name=f"test_multi_split_experiment_{token_hex(4)}",
                experiment_description="Test experiment with multiple dataset splits",
                print_summary=False,
            )
        )

        assert len(multi_split_result["task_runs"]) == 4, (
            f"Expected 4 task runs (both splits), got {len(multi_split_result['task_runs'])}"
        )

        multi_split_exp_id = multi_split_result["experiment_id"]

        # Verify both splits are associated with the experiment
        multi_splits_verification, _ = _gql(
            _app,
            _app.admin_secret,
            query=verify_splits_query,
            variables={"experimentId": multi_split_exp_id},
        )

        multi_exp_node = multi_splits_verification["data"]["node"]
        multi_splits_edges = multi_exp_node["datasetSplits"]["edges"]
        assert len(multi_splits_edges) == 2, (
            f"Expected 2 splits associated with experiment, got {len(multi_splits_edges)}"
        )

        # Verify both split IDs are present
        associated_split_ids = {edge["node"]["id"] for edge in multi_splits_edges}
        assert train_split_id in associated_split_ids, (
            f"Train split {train_split_id} should be in associated splits"
        )
        assert test_split_id in associated_split_ids, (
            f"Test split {test_split_id} should be in associated splits"
        )
