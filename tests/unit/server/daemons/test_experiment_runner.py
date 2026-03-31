from __future__ import annotations

import heapq
from datetime import datetime, timedelta, timezone
from typing import Any, Hashable, Sequence
from unittest.mock import AsyncMock, MagicMock, patch

import anyio
import pytest

from phoenix.db import models
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
)
from phoenix.server.daemons.experiment_runner import (
    CircuitBreaker,
    EvaluatorRunSpec,
    EvalWorkItem,
    RetryItem,
    RunningExperiment,
    TaskWorkItem,
    _NoOpLLMClient,
)
from phoenix.server.rate_limiters import UnavailableTokensError
from phoenix.server.types import DbSessionFactory

# ---------------------------------------------------------------------------
# Helpers / Factories
# ---------------------------------------------------------------------------


def _make_experiment(experiment_id: int = 1) -> models.Experiment:
    exp = MagicMock(spec=models.Experiment)
    exp.id = experiment_id
    exp.project_name = "test-project"
    return exp


def _make_experiment_job(
    experiment_id: int = 1,
    *,
    max_concurrency: int = 10,
) -> models.ExperimentJob:
    config = MagicMock(spec=models.ExperimentJob)
    config.id = experiment_id
    config.max_concurrency = max_concurrency
    return config


def _make_dataset_example_revision(
    dataset_example_id: int = 100,
) -> models.DatasetExampleRevision:
    rev = MagicMock(spec=models.DatasetExampleRevision)
    rev.dataset_example_id = dataset_example_id
    rev.input = {"question": "test"}
    rev.output = {"answer": "42"}
    rev.metadata_ = {}
    return rev


def _make_experiment_run(
    run_id: int = 1,
    experiment_id: int = 1,
    repetition_number: int = 0,
) -> models.ExperimentRun:
    run = MagicMock(spec=models.ExperimentRun)
    run.id = run_id
    run.experiment_id = experiment_id
    run.repetition_number = repetition_number
    run.output = {"task_output": "result"}
    return run


class _StubTokenBucket:
    """Token bucket that always allows requests (no rate limiting)."""

    def on_rate_limit_error(self, request_start_time: float, verbose: bool = False) -> None:
        pass

    def make_request_if_ready(self) -> None:
        pass


class _BlockingTokenBucket:
    """Token bucket that always raises UnavailableTokensError."""

    def on_rate_limit_error(self, request_start_time: float, verbose: bool = False) -> None:
        pass

    def make_request_if_ready(self) -> None:
        raise UnavailableTokensError


class _StubTokenBucketRegistry:
    """Registry that returns the same bucket for all keys."""

    def __init__(self, bucket: Any = None) -> None:
        self._bucket = bucket or _StubTokenBucket()

    def __getitem__(self, key: Hashable) -> Any:
        return self._bucket


def _make_on_done() -> AsyncMock:
    return AsyncMock()


def _make_running_experiment(
    experiment_id: int = 1,
    *,
    max_concurrency: int = 10,
    evaluator_run_specs: Sequence[EvaluatorRunSpec] = (),
    token_buckets: Any = None,
    on_done: Any = None,
    max_retries: int = 3,
    base_backoff_seconds: float = 0.01,
) -> RunningExperiment:
    return RunningExperiment(
        experiment=_make_experiment(experiment_id),
        experiment_job=_make_experiment_job(experiment_id, max_concurrency=max_concurrency),
        llm_client=_NoOpLLMClient(),
        db=MagicMock(spec=DbSessionFactory),
        decrypt=lambda b: b,
        tracer_factory=MagicMock(),
        token_buckets=token_buckets or _StubTokenBucketRegistry(),
        on_done=on_done or _make_on_done(),
        evaluator_run_specs=evaluator_run_specs,
        max_retries=max_retries,
        base_backoff_seconds=base_backoff_seconds,
    )


class _StubLLMClient:
    """LLM client stub that provides a hashable rate limit key."""

    def get_rate_limit_key(self) -> Hashable:
        return "stub-llm"

    def is_rate_limit_error(self, e: Exception) -> bool:
        return False

    def is_transient_error(self, e: Exception) -> bool:
        return False


def _make_task_work_item(
    running_experiment: RunningExperiment,
    *,
    dataset_example_id: int = 100,
    repetition_number: int = 0,
    retry_count: int = 0,
) -> TaskWorkItem:
    return TaskWorkItem(
        running_experiment=running_experiment,
        experiment=running_experiment._experiment,
        dataset_example_revision=_make_dataset_example_revision(dataset_example_id),
        repetition_number=repetition_number,
        prompt_task=MagicMock(spec=models.ExperimentPromptTask),
        llm_client=_StubLLMClient(),  # type: ignore[arg-type]
        db=running_experiment._db,
        decrypt=running_experiment._decrypt,
        tracer_factory=running_experiment._tracer_factory,
        project_id=1,
        retry_count=retry_count,
    )


def _make_eval_work_item(
    running_experiment: RunningExperiment,
    *,
    run_id: int = 1,
    dataset_evaluator_id: int = 10,
    retry_count: int = 0,
) -> EvalWorkItem:
    evaluator = MagicMock()
    evaluator.name = "test-evaluator"
    output_config = MagicMock()
    output_config.name = "test-output"
    return EvalWorkItem(
        running_experiment=running_experiment,
        experiment_run=_make_experiment_run(run_id=run_id),
        dataset_example_revision=_make_dataset_example_revision(),
        dataset_evaluator_id=dataset_evaluator_id,
        evaluator=evaluator,
        db=running_experiment._db,
        tracer_factory=running_experiment._tracer_factory,
        project_id=1,
        input_mapping=MagicMock(),
        output_configs=[output_config],
        retry_count=retry_count,
    )


# ===========================================================================
# Group 1: CircuitBreaker (pure unit, no fixtures)
# ===========================================================================


class TestCircuitBreaker:
    def test_record_success_resets_counter(self) -> None:
        cb = CircuitBreaker(threshold=3)
        cb.record_failure(RuntimeError("e1"))
        cb.record_failure(RuntimeError("e2"))
        assert cb._consecutive_failures == 2
        cb.record_success()
        assert cb._consecutive_failures == 0
        assert not cb.is_tripped

    def test_trips_at_threshold_and_stays_tripped(self) -> None:
        cb = CircuitBreaker(threshold=3)
        cb.record_failure(RuntimeError("e1"))
        cb.record_failure(RuntimeError("e2"))
        tripped = cb.record_failure(RuntimeError("e3"))
        assert tripped is True
        assert cb.is_tripped
        assert cb.trip_reason == "e3"
        # Success after trip does NOT un-trip
        cb.record_success()
        assert cb.is_tripped

    def test_already_tripped_ignores_further_failures(self) -> None:
        cb = CircuitBreaker(threshold=2)
        cb.record_failure(RuntimeError("e1"))
        assert cb.record_failure(RuntimeError("e2")) is True
        assert cb.is_tripped
        # Further failures return False (already tripped)
        assert cb.record_failure(RuntimeError("e3")) is False


# ===========================================================================
# Group 2: RunningExperiment queue logic (mock deps, no DB)
# ===========================================================================


class TestRunningExperimentQueueLogic:
    def test_has_work_when_eval_db_not_exhausted(self) -> None:
        exp = _make_running_experiment()
        # Default: _eval_db_exhausted is True (no evaluators), _task_db_exhausted is False
        assert exp.has_work() is True
        exp._task_db_exhausted = True
        assert exp.has_work() is False

    def test_has_work_with_evaluators(self) -> None:
        spec = MagicMock(spec=EvaluatorRunSpec)
        exp = _make_running_experiment(evaluator_run_specs=[spec])
        # With evaluators, _eval_db_exhausted starts as False
        assert exp._eval_db_exhausted is False
        assert exp.has_work() is True

    @pytest.mark.anyio
    async def test_try_get_ready_work_item_priority_order(self) -> None:
        """Evals > ready retries > tasks."""
        exp = _make_running_experiment()
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True

        task = _make_task_work_item(exp, dataset_example_id=1)
        eval_work_item = _make_eval_work_item(exp)
        retry_task = _make_task_work_item(exp, dataset_example_id=2)
        retry_item = RetryItem(
            ready_at=datetime.now(timezone.utc) - timedelta(seconds=1),
            work_item=retry_task,
        )

        # Add all three types
        exp._task_queue.append(task)
        exp._eval_queue.append(eval_work_item)
        heapq.heappush(exp._retry_heap, retry_item)

        # First: eval (highest priority)
        work_item1 = await exp.try_get_ready_work_item()
        assert work_item1 is eval_work_item

        # Second: ready retry
        work_item2 = await exp.try_get_ready_work_item()
        assert work_item2 is retry_task

        # Third: task
        work_item3 = await exp.try_get_ready_work_item()
        assert work_item3 is task

    @pytest.mark.anyio
    async def test_try_get_ready_work_item_rate_limited(self) -> None:
        """Returns None when token bucket raises UnavailableTokensError."""
        exp = _make_running_experiment(
            token_buckets=_StubTokenBucketRegistry(_BlockingTokenBucket())
        )
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True

        task = _make_task_work_item(exp)
        exp._task_queue.append(task)

        work_item = await exp.try_get_ready_work_item()
        assert work_item is None
        # Task should still be in queue (not consumed)
        assert len(exp._task_queue) == 1

    @pytest.mark.anyio
    async def test_try_get_ready_work_item_respects_max_concurrency(self) -> None:
        """Returns None when in_flight >= max_concurrency."""
        exp = _make_running_experiment(max_concurrency=1)
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True

        task1 = _make_task_work_item(exp, dataset_example_id=1)
        task2 = _make_task_work_item(exp, dataset_example_id=2)
        exp._task_queue.append(task1)
        exp._task_queue.append(task2)

        # Simulate one in-flight work item
        exp._in_flight.add(task1)
        exp._task_queue.popleft()

        work_item = await exp.try_get_ready_work_item()
        assert work_item is None

    @pytest.mark.anyio
    async def test_on_rate_limit_requeues_with_backoff(self) -> None:
        """Work item lands in retry heap with correct ready_at."""
        exp = _make_running_experiment(base_backoff_seconds=1.0)
        task = _make_task_work_item(exp)
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True

        before = datetime.now(timezone.utc)
        await exp.on_rate_limit(task)
        after = datetime.now(timezone.utc)

        assert len(exp._retry_heap) == 1
        retry = exp._retry_heap[0]
        assert retry.work_item is task
        assert task.retry_count == 1
        # Backoff = 1.0 * 2^(1-1) = 1.0s
        assert retry.ready_at >= before + timedelta(seconds=1.0)
        assert retry.ready_at <= after + timedelta(seconds=1.0)

    @pytest.mark.anyio
    async def test_retry_or_fail_exhausted(self) -> None:
        """After max retries, failure counted and error recorded."""
        exp = _make_running_experiment(max_retries=2)
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True

        task = _make_task_work_item(exp, retry_count=2)  # Already at max

        with patch.object(exp, "_persist_log", new_callable=AsyncMock) as mock_record:
            await exp._retry_or_fail(task, "test failure")

        assert exp._tasks_failed == 1
        mock_record.assert_called_once()
        # Should NOT be requeued
        assert len(exp._retry_heap) == 0

    @pytest.mark.anyio
    async def test_on_transient_error_trips_circuit_breaker(self) -> None:
        """5 consecutive transient errors trip the circuit breaker."""
        exp = _make_running_experiment()
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True

        with patch.object(exp, "_handle_circuit_trip", new_callable=AsyncMock) as mock_trip:
            for i in range(5):
                task = _make_task_work_item(exp, dataset_example_id=i)
                await exp.on_transient_error(task, RuntimeError(f"error-{i}"))

        mock_trip.assert_called_once()
        assert exp._task_circuit_breaker.is_tripped

    @pytest.mark.anyio
    async def test_check_completion_fires_on_done(self) -> None:
        """When has_work() returns False, _on_done callback invoked."""
        on_done = _make_on_done()
        exp = _make_running_experiment(on_done=on_done)
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True

        await exp._check_completion()

        assert not exp._active
        on_done.assert_called_once_with(exp._experiment.id)

    def test_stop_cancels_in_flight_and_clears_queues(self) -> None:
        """stop() cancels scopes, clears queues and subscribers."""
        exp = _make_running_experiment()

        task = _make_task_work_item(exp, dataset_example_id=1)
        eval_work_item = _make_eval_work_item(exp)
        scope = MagicMock(spec=anyio.CancelScope)

        exp._task_queue.append(task)
        exp._eval_queue.append(eval_work_item)
        exp._cancel_scopes[task] = scope
        exp._in_flight.add(task)

        # Add a subscriber
        send_stream = MagicMock()
        exp._subscribers.append(send_stream)

        exp.stop()

        assert not exp._active
        assert len(exp._task_queue) == 0
        assert len(exp._eval_queue) == 0
        assert len(exp._retry_heap) == 0
        scope.cancel.assert_called_once()
        send_stream.close.assert_called_once()
        assert len(exp._subscribers) == 0


# ===========================================================================
# Group 3: Round-robin fairness
# ===========================================================================


class TestRoundRobinFairness:
    @pytest.mark.anyio
    async def test_round_robin_picks_least_recently_served(self) -> None:
        """_try_get_ready_work_item in ExperimentRunner picks least-recently-served experiment."""
        from phoenix.server.daemons.experiment_runner import ExperimentRunner

        runner = object.__new__(ExperimentRunner)
        runner._experiments = {}

        exp_a = _make_running_experiment(experiment_id=1)
        exp_a._task_db_exhausted = True
        exp_a._eval_db_exhausted = True
        exp_a.last_served_at = datetime(2024, 1, 1, 0, 0, 1, tzinfo=timezone.utc)

        exp_b = _make_running_experiment(experiment_id=2)
        exp_b._task_db_exhausted = True
        exp_b._eval_db_exhausted = True
        exp_b.last_served_at = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)  # older

        task_a = _make_task_work_item(exp_a, dataset_example_id=1)
        task_b = _make_task_work_item(exp_b, dataset_example_id=2)
        exp_a._task_queue.append(task_a)
        exp_b._task_queue.append(task_b)

        runner._experiments = {1: exp_a, 2: exp_b}

        work_item = await runner._try_get_ready_work_item()
        # exp_b was served less recently, so it should be picked first
        assert work_item is task_b


# ===========================================================================
# Group 4: EvalWorkItem cancellation
# ===========================================================================


class TestEvalWorkItemCancellation:
    @pytest.mark.anyio
    async def test_eval_work_item_cancellation_reraises(self) -> None:
        """Cancelled EvalWorkItem re-raises instead of falling to error handler."""
        exp = _make_running_experiment()
        eval_work_item = _make_eval_work_item(exp)

        async def raise_cancelled(**kwargs: Any) -> list[Any]:
            raise anyio.get_cancelled_exc_class()()

        with patch.object(eval_work_item._evaluator, "evaluate", side_effect=raise_cancelled):
            with pytest.raises(anyio.get_cancelled_exc_class()):
                await eval_work_item.execute()


# ===========================================================================
# Group 5: Graceful shutdown
# ===========================================================================


class TestGracefulShutdown:
    @pytest.mark.anyio
    async def test_graceful_shutdown_stops_all(self) -> None:
        """_graceful_shutdown calls stop() on each experiment."""
        from phoenix.server.daemons.experiment_runner import ExperimentRunner

        runner = object.__new__(ExperimentRunner)
        runner._experiments = {}
        runner._seats = anyio.Semaphore(10)

        exp1 = _make_running_experiment(experiment_id=1)
        exp2 = _make_running_experiment(experiment_id=2)

        runner._experiments = {1: exp1, 2: exp2}

        with (
            patch.object(exp1, "stop") as stop1,
            patch.object(exp2, "stop") as stop2,
        ):
            await runner._graceful_shutdown(timeout=1.0)

        stop1.assert_called_once()
        stop2.assert_called_once()


# ===========================================================================
# Group 6: Error persistence
# ===========================================================================


class TestTaskWorkItemPersistsErrorRun:
    @pytest.mark.anyio
    async def test_non_retryable_llm_error_persists_error_run(self) -> None:
        """A non-retryable LLM error (e.g. 400) should persist an ExperimentRun with error
        and call on_failure."""
        exp = _make_running_experiment()
        task = _make_task_work_item(exp, dataset_example_id=42)

        error = RuntimeError("Bad request (injected)")

        persisted_run = MagicMock(spec=models.ExperimentRun)
        persisted_run.id = 701

        mock_persist = AsyncMock(return_value=persisted_run)
        mock_on_failure = AsyncMock()
        mock_broadcast = MagicMock()

        with (
            patch.object(task, "_build_messages", return_value=[]),
            patch.object(
                task._llm_client, "chat_completion_create", side_effect=error, create=True
            ),
            patch(
                "phoenix.server.daemons.experiment_runner.get_raw_invocation_parameters",
                return_value={},
            ),
            patch.object(exp, "on_failure", mock_on_failure),
            patch.object(exp, "_broadcast", mock_broadcast),
            patch.object(task, "_persist_run", mock_persist),
        ):
            await task.execute()

        # Verify error run was persisted with correct fields
        mock_persist.assert_awaited_once()
        persist_call = mock_persist.await_args
        assert persist_call is not None
        db_run_arg = persist_call.args[0]
        assert isinstance(db_run_arg, models.ExperimentRun)
        assert db_run_arg.error == "Bad request (injected)"
        assert db_run_arg.experiment_id == exp._experiment.id
        assert db_run_arg.dataset_example_id == 42
        assert db_run_arg.output == {}
        assert db_run_arg.start_time is not None
        assert db_run_arg.end_time is not None

        # Verify on_failure was called with the original error
        mock_on_failure.assert_awaited_once()
        failure_args = mock_on_failure.await_args
        assert failure_args is not None
        assert failure_args.args[0] is task
        assert failure_args.args[1] is error

        # Verify only error was broadcast (not result, to avoid double-counting)
        assert mock_broadcast.call_count == 1
        error_broadcast = mock_broadcast.call_args_list[0].args[0]
        assert isinstance(error_broadcast, ChatCompletionSubscriptionError)


class TestEvalWorkItemPersistsErrorAnnotation:
    @pytest.mark.anyio
    async def test_non_retryable_eval_error_persists_error_annotation(self) -> None:
        """A non-retryable eval error should persist error annotations and traces,
        and call on_failure."""
        exp = _make_running_experiment()
        eval_item = _make_eval_work_item(exp)

        error = RuntimeError("Bad request (injected)")
        mock_on_failure = AsyncMock()
        mock_persist = AsyncMock()

        with (
            patch.object(eval_item._evaluator, "evaluate", side_effect=error),
            patch.object(exp, "on_failure", mock_on_failure),
            patch.object(eval_item, "_persist_eval_results", mock_persist),
        ):
            await eval_item.execute()

        # Verify _persist_eval_results was called with error annotations
        mock_persist.assert_awaited_once()
        persist_call = mock_persist.await_args
        assert persist_call is not None
        annotations_arg = persist_call.args[0]
        assert len(annotations_arg) == 1
        annotation = annotations_arg[0]
        assert isinstance(annotation, models.ExperimentRunAnnotation)
        assert annotation.error == "Bad request (injected)"
        assert annotation.name == "test-output"
        assert annotation.score is None
        assert annotation.label is None

        # Verify on_failure was called with the original error
        mock_on_failure.assert_awaited_once()
        failure_args = mock_on_failure.await_args
        assert failure_args is not None
        assert failure_args.args[0] is eval_item
        assert failure_args.args[1] is error
