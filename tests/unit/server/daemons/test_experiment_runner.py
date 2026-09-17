from __future__ import annotations

import heapq
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, AsyncIterator, Hashable, Sequence, cast
from unittest.mock import AsyncMock, MagicMock, patch

import anyio
import pytest
from anyio.streams.memory import MemoryObjectReceiveStream
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
    OutputConfigType,
)
from phoenix.db.types.evaluator_definition import (
    EvaluatorDefinition,
    InlineCodeEvaluatorDefinition,
    InlineLLMEvaluatorDefinition,
    InlineLLMEvaluatorPromptVersion,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptTemplateFormat,
    PromptToolChoiceOneOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
)
from phoenix.server.api.evaluators import (
    BaseEvaluator,
    CodeEvaluatorRunner,
    EvaluationResult,
    LLMEvaluator,
)
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionPayload,
    ChatCompletionSubscriptionResult,
    EvaluationChunk,
    FunctionCallChunk,
    ToolCallChunk,
)
from phoenix.server.daemons.experiment_runner import (
    _NO_OP_LLM_CLIENT,
    CircuitBreaker,
    EvaluatorRunSpec,
    EvaluatorTaskWorkItem,
    EvalWorkItem,
    ExperimentRunner,
    RetryItem,
    RunningExperiment,
    TaskWorkItem,
    WorkItem,
    _NoOpLLMClient,
)
from phoenix.server.monty_runtime import MontyBusy
from phoenix.server.rate_limiters import UnavailableTokensError
from phoenix.server.sandbox.result_protocol import PHOENIX_RESULT_BEGIN, PHOENIX_RESULT_END
from phoenix.server.sandbox.types import ExecutionResult
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer

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


class _AsyncSessionContext:
    """Minimal async context manager wrapper for mocked DB sessions."""

    def __init__(self, session: Any) -> None:
        self._session = session

    async def __aenter__(self) -> Any:
        return self._session

    async def __aexit__(self, *args: Any) -> None:
        return None


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
    output_names: Sequence[str] = ("test-output",),
    retry_count: int = 0,
) -> EvalWorkItem:
    evaluator = MagicMock()
    evaluator.name = "test-evaluator"
    output_configs = []
    for output_name in output_names:
        output_config = MagicMock()
        output_config.name = output_name
        output_configs.append(output_config)
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
        output_configs=output_configs,
        retry_count=retry_count,
    )


def _assert_untracked(exp: RunningExperiment, work_item: WorkItem) -> None:
    """The experiment holds no dispatch or execution state for the item."""
    assert work_item not in exp._in_flight
    assert work_item not in exp._cancel_scopes
    assert work_item not in exp._dispatch_undo


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
        assert cb.trip_reason == "RuntimeError"
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
    def test_task_batch_size_scales_with_max_concurrency(self) -> None:
        exp = _make_running_experiment(max_concurrency=20)
        assert exp._task_batch_size == 40

    def test_task_batch_size_is_bounded(self) -> None:
        exp_low = _make_running_experiment(max_concurrency=1)
        assert exp_low._task_batch_size == 10

        exp_zero = _make_running_experiment(max_concurrency=0)
        assert exp_zero._task_batch_size == 10

        exp_high = _make_running_experiment(max_concurrency=500)
        assert exp_high._task_batch_size == 200

    def test_backpressure_hysteresis_toggles_only_at_watermarks(self) -> None:
        exp = _make_running_experiment(max_concurrency=1)
        exp._work_item_high_watermark = 4
        exp._work_item_low_watermark = 2

        # Below high watermark -> remains off.
        for i in range(4):
            exp._task_queue.append(_make_task_work_item(exp, dataset_example_id=100 + i))
        exp._task_queue.pop()  # resident=3
        exp._update_backpressure_state()
        assert exp._backpressure_active is False

        # At high watermark -> turns on.
        exp._task_queue.append(_make_task_work_item(exp, dataset_example_id=104))  # resident=4
        exp._update_backpressure_state()
        assert exp._backpressure_active is True

        # Above low watermark -> stays on.
        exp._task_queue.popleft()  # resident=3
        exp._update_backpressure_state()
        assert exp._backpressure_active is True

        # At/below low watermark -> turns off.
        exp._task_queue.popleft()  # resident=2
        exp._update_backpressure_state()
        assert exp._backpressure_active is False

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
    async def test_try_get_ready_work_item_blocks_task_scan_during_initial_eval_scan(
        self,
    ) -> None:
        """Phase 1 runs initial eval scan first; task scan is blocked until exhausted."""
        output_config = MagicMock()
        output_config.name = "accuracy"
        evaluator = MagicMock()
        evaluator.name = "quality-evaluator"
        spec = EvaluatorRunSpec(
            dataset_evaluator_id=91,
            evaluator=evaluator,
            input_mapping=MagicMock(),
            output_configs=[output_config],
            evaluator_project_id=1,
        )
        exp = _make_running_experiment(evaluator_run_specs=[spec])
        exp._eval_db_exhausted = False
        exp._initial_eval_scan_done = False

        with (
            patch.object(exp, "_ensure_eval_buffer", new_callable=AsyncMock) as mock_eval_buffer,
            patch.object(exp, "_ensure_task_buffer", new_callable=AsyncMock) as mock_task_buffer,
        ):
            await exp.try_get_ready_work_item()

        mock_eval_buffer.assert_awaited_once()
        mock_task_buffer.assert_not_awaited()

    @pytest.mark.anyio
    async def test_try_get_ready_work_item_transitions_to_task_scan_after_initial_eval_scan(
        self,
    ) -> None:
        """When initial eval scan exhausts, same call enables task scan."""
        output_config = MagicMock()
        output_config.name = "accuracy"
        evaluator = MagicMock()
        evaluator.name = "quality-evaluator"
        spec = EvaluatorRunSpec(
            dataset_evaluator_id=92,
            evaluator=evaluator,
            input_mapping=MagicMock(),
            output_configs=[output_config],
            evaluator_project_id=1,
        )
        exp = _make_running_experiment(evaluator_run_specs=[spec])
        exp._eval_db_exhausted = False
        exp._initial_eval_scan_done = False

        def _mark_exhausted() -> None:
            exp._eval_db_exhausted = True

        with (
            patch.object(exp, "_ensure_eval_buffer", new_callable=AsyncMock) as mock_eval_buffer,
            patch.object(exp, "_ensure_task_buffer", new_callable=AsyncMock) as mock_task_buffer,
        ):
            mock_eval_buffer.side_effect = _mark_exhausted
            await exp.try_get_ready_work_item()
            await exp.try_get_ready_work_item()

        assert exp._initial_eval_scan_done is True
        # First call: eval scan + task scan (after transition)
        # Second call: task scan only.
        assert mock_eval_buffer.await_count == 1
        assert mock_task_buffer.await_count == 2

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
    async def test_unregister_cancel_scope_cleans_in_flight_state(self) -> None:
        """Unregister always removes work item from in-flight and scope maps."""
        exp = _make_running_experiment()
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True
        eval_item = _make_eval_work_item(exp, run_id=313, dataset_evaluator_id=1)
        exp._eval_queue.append(eval_item)

        assert await exp.try_get_ready_work_item() is eval_item
        assert eval_item in exp._in_flight
        assert eval_item in exp._cancel_scopes
        assert eval_item in exp._dispatch_undo
        assert exp.start_execution(eval_item) is exp._cancel_scopes[eval_item]
        assert eval_item not in exp._dispatch_undo  # no longer undoable once started

        await exp.unregister_cancel_scope(eval_item)

        _assert_untracked(exp, eval_item)

    @pytest.mark.anyio
    async def test_dispatched_work_item_counts_as_in_flight_before_it_starts(self) -> None:
        """A dispatched item keeps the experiment alive until its worker has run it.

        The daemon starts workers with start_soon(), so another task can finish and run
        a completion check before the dispatched item's worker has begun. The item must
        already count as in-flight, or the experiment completes without it.
        """
        on_done = _make_on_done()
        exp = _make_running_experiment(on_done=on_done)
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True
        finishing = _make_task_work_item(exp, dataset_example_id=1)
        dispatched = _make_task_work_item(exp, dataset_example_id=2)
        exp._task_queue.extend([finishing, dispatched])

        assert await exp.try_get_ready_work_item() is finishing
        assert await exp.try_get_ready_work_item() is dispatched
        assert exp.has_work()

        # The first item's worker runs to completion before the second one's has begun.
        with exp.start_execution(finishing):
            pass
        await exp.unregister_cancel_scope(finishing)

        assert exp._active
        on_done.assert_not_called()

        # The second item's worker runs and finishes; only now is the experiment done.
        with exp.start_execution(dispatched):
            pass
        await exp.unregister_cancel_scope(dispatched)

        assert not exp._active
        on_done.assert_called_once_with(exp._experiment.id)

    @pytest.mark.anyio
    async def test_stop_cancels_dispatched_item_before_its_worker_starts(self) -> None:
        """An item dispatched before stop() is cancelled when its worker enters the scope.

        The scope exists from dispatch, so stop() cancels it like any other. A worker
        that enters it afterwards is cancelled at its first checkpoint, and the
        experiment drains once that worker has unregistered.
        """
        exp = _make_running_experiment()
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True
        dispatched = _make_task_work_item(exp, dataset_example_id=1)
        exp._task_queue.append(dispatched)
        assert await exp.try_get_ready_work_item() is dispatched

        exp.stop()
        assert not exp._drained.is_set()

        reached_past_first_checkpoint = False
        with exp.start_execution(dispatched) as scope:
            assert scope.cancel_called
            await anyio.sleep(0)  # first checkpoint: the pre-entry cancel lands here
            reached_past_first_checkpoint = True
        assert scope.cancelled_caught
        assert not reached_past_first_checkpoint

        await exp.unregister_cancel_scope(dispatched)
        assert exp._drained.is_set()

    @pytest.mark.anyio
    async def test_undispatch_puts_item_back_where_it_came_from(self) -> None:
        """A dispatch whose worker could not start is reversed exactly.

        Evals, ready retries and tasks come from different structures. A retry must go
        back as its original RetryItem so it keeps its ready time and its ordering.
        """
        exp = _make_running_experiment()
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True
        eval_item = _make_eval_work_item(exp)
        now = datetime.now(timezone.utc)
        first_retry = RetryItem(
            ready_at=now - timedelta(seconds=2),
            work_item=_make_task_work_item(exp, dataset_example_id=1, retry_count=1),
        )
        second_retry = RetryItem(
            ready_at=now - timedelta(seconds=1),
            work_item=_make_task_work_item(exp, dataset_example_id=2, retry_count=1),
        )
        task = _make_task_work_item(exp, dataset_example_id=3)
        exp._eval_queue.append(eval_item)
        heapq.heappush(exp._retry_heap, second_retry)
        heapq.heappush(exp._retry_heap, first_retry)
        exp._task_queue.append(task)

        async def dispatch_then_undo(expected: WorkItem) -> None:
            dispatched = await exp.try_get_ready_work_item()
            assert dispatched is expected
            exp.undispatch(dispatched)
            _assert_untracked(exp, dispatched)
            assert exp.has_work()

        async def run_to_completion(expected: WorkItem) -> None:
            assert await exp.try_get_ready_work_item() is expected
            with exp.start_execution(expected):
                pass
            await exp.unregister_cancel_scope(expected)
            _assert_untracked(exp, expected)

        await dispatch_then_undo(eval_item)
        assert list(exp._eval_queue) == [eval_item]
        await run_to_completion(eval_item)

        # The earlier retry is restored as the same RetryItem, still ahead of its peer.
        await dispatch_then_undo(first_retry.work_item)
        assert exp._retry_heap[0] is first_retry
        assert exp._retry_heap[1] is second_retry
        await run_to_completion(first_retry.work_item)
        await run_to_completion(second_retry.work_item)

        await dispatch_then_undo(task)
        assert list(exp._task_queue) == [task]
        await run_to_completion(task)

        assert not exp.has_work()

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
    async def test_retry_or_fail_exhausted_eval_broadcasts_error_chunks(self) -> None:
        """Exhausted eval retries broadcast terminal error chunks to subscribers."""
        exp = _make_running_experiment(max_retries=1)
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True

        eval_item = _make_eval_work_item(
            exp,
            retry_count=1,  # already at max retry count
            output_names=("accuracy", "conciseness"),
        )

        with (
            patch.object(exp, "_persist_log", new_callable=AsyncMock) as mock_record,
            patch.object(exp, "_persist_exhausted_retry", new_callable=AsyncMock) as mock_persist,
            patch.object(exp, "_broadcast") as mock_broadcast,
        ):
            await exp._retry_or_fail(eval_item, "timeout")

        assert exp._evals_failed == 1
        mock_record.assert_called_once()
        mock_persist.assert_awaited_once()
        assert mock_broadcast.call_count == 2
        emitted = [call.args[0] for call in mock_broadcast.call_args_list]
        assert all(isinstance(chunk, EvaluationChunk) for chunk in emitted)
        assert [chunk.evaluator_name for chunk in emitted] == ["accuracy", "conciseness"]
        assert all(chunk.error == "timeout after 1 retries" for chunk in emitted)

    @pytest.mark.anyio
    async def test_ensure_eval_buffer_queues_multi_output_evaluator_once(self) -> None:
        """Resume scan queues one EvalWorkItem per evaluator, not per output name."""
        output_config_a = MagicMock()
        output_config_a.name = "accuracy"
        output_config_b = MagicMock()
        output_config_b.name = "conciseness"
        evaluator = MagicMock()
        evaluator.name = "quality-evaluator"
        spec = EvaluatorRunSpec(
            dataset_evaluator_id=42,
            evaluator=evaluator,
            input_mapping=MagicMock(),
            output_configs=[output_config_a, output_config_b],
            evaluator_project_id=1,
        )
        exp = _make_running_experiment(evaluator_run_specs=[spec])
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = False

        run = _make_experiment_run(run_id=7, repetition_number=1)
        revision = _make_dataset_example_revision(dataset_example_id=99)
        result = MagicMock()
        result.all.return_value = [(run, 1, revision, "[]")]
        session = MagicMock()
        session.bind = MagicMock()
        session.bind.dialect.name = "postgresql"
        session.execute = AsyncMock(return_value=result)
        exp._db = MagicMock(return_value=_AsyncSessionContext(session))

        await exp._ensure_eval_buffer()

        assert len(exp._eval_queue) == 1
        queued_item = exp._eval_queue[0]
        assert isinstance(queued_item, EvalWorkItem)
        assert queued_item.dataset_evaluator_id == 42

    @pytest.mark.anyio
    async def test_ensure_eval_buffer_scans_even_when_tasks_pending(self) -> None:
        """Bootstrap reconciliation does not gate on task-phase state."""
        output_config = MagicMock()
        output_config.name = "accuracy"
        evaluator = MagicMock()
        evaluator.name = "quality-evaluator"
        spec = EvaluatorRunSpec(
            dataset_evaluator_id=77,
            evaluator=evaluator,
            input_mapping=MagicMock(),
            output_configs=[output_config],
            evaluator_project_id=1,
        )
        exp = _make_running_experiment(evaluator_run_specs=[spec])
        exp._task_db_exhausted = False
        exp._eval_db_exhausted = False
        exp._task_queue.append(_make_task_work_item(exp, dataset_example_id=123))

        run = _make_experiment_run(run_id=8, repetition_number=1)
        revision = _make_dataset_example_revision(dataset_example_id=1001)
        result = MagicMock()
        result.all.return_value = [(run, 1, revision, "[]")]
        session = MagicMock()
        session.bind = MagicMock()
        session.bind.dialect.name = "postgresql"
        session.execute = AsyncMock(return_value=result)
        exp._db = MagicMock(return_value=_AsyncSessionContext(session))

        await exp._ensure_eval_buffer()

        session.execute.assert_awaited_once()
        assert len(exp._eval_queue) == 1

    @pytest.mark.anyio
    async def test_ensure_eval_buffer_does_not_check_eval_key_reservations(self) -> None:
        """Reconciliation scan no longer depends on key reservation state."""
        output_config = MagicMock()
        output_config.name = "accuracy"
        evaluator = MagicMock()
        evaluator.name = "quality-evaluator"
        spec = EvaluatorRunSpec(
            dataset_evaluator_id=88,
            evaluator=evaluator,
            input_mapping=MagicMock(),
            output_configs=[output_config],
            evaluator_project_id=1,
        )
        exp = _make_running_experiment(evaluator_run_specs=[spec])
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = False

        # DB has an incomplete run (run_id=10); scanner should enqueue it.
        run = _make_experiment_run(run_id=10, repetition_number=1)
        revision = _make_dataset_example_revision(dataset_example_id=1002)
        result = MagicMock()
        result.all.return_value = [(run, 1, revision, "[]")]
        session = MagicMock()
        session.bind = MagicMock()
        session.bind.dialect.name = "postgresql"
        session.execute = AsyncMock(return_value=result)
        exp._db = MagicMock(return_value=_AsyncSessionContext(session))

        await exp._ensure_eval_buffer()

        session.execute.assert_awaited_once()
        assert len(exp._eval_queue) == 1
        queued_item = exp._eval_queue[0]
        assert isinstance(queued_item, EvalWorkItem)
        assert queued_item.experiment_run.id == 10

    @pytest.mark.anyio
    async def test_ensure_eval_buffer_scans_even_when_task_retry_pending(self) -> None:
        """Bootstrap reconciliation ignores task retry state."""
        output_config = MagicMock()
        output_config.name = "accuracy"
        evaluator = MagicMock()
        evaluator.name = "quality-evaluator"
        spec = EvaluatorRunSpec(
            dataset_evaluator_id=89,
            evaluator=evaluator,
            input_mapping=MagicMock(),
            output_configs=[output_config],
            evaluator_project_id=1,
        )
        exp = _make_running_experiment(evaluator_run_specs=[spec])
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = False

        retry_task = _make_task_work_item(exp, dataset_example_id=1100)
        heapq.heappush(
            exp._retry_heap,
            RetryItem(
                ready_at=datetime.now(timezone.utc) + timedelta(seconds=60),
                work_item=retry_task,
            ),
        )

        run = _make_experiment_run(run_id=10, repetition_number=1)
        revision = _make_dataset_example_revision(dataset_example_id=1003)
        result = MagicMock()
        result.all.return_value = [(run, 1, revision, "[]")]
        session = MagicMock()
        session.bind = MagicMock()
        session.bind.dialect.name = "postgresql"
        session.execute = AsyncMock(return_value=result)
        exp._db = MagicMock(return_value=_AsyncSessionContext(session))

        await exp._ensure_eval_buffer()

        session.execute.assert_awaited_once()
        assert len(exp._eval_queue) == 1

    @pytest.mark.anyio
    async def test_ensure_eval_buffer_pauses_and_resumes_with_backpressure(self) -> None:
        """Backpressure pauses eval scanning until resident work drops below low watermark."""
        output_config = MagicMock()
        output_config.name = "accuracy"
        evaluator = MagicMock()
        evaluator.name = "quality-evaluator"
        spec = EvaluatorRunSpec(
            dataset_evaluator_id=95,
            evaluator=evaluator,
            input_mapping=MagicMock(),
            output_configs=[output_config],
            evaluator_project_id=1,
        )
        exp = _make_running_experiment(evaluator_run_specs=[spec])
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = False
        exp._work_item_high_watermark = 1
        exp._work_item_low_watermark = 0

        # One retry item is enough to trip backpressure.
        retry_task = _make_task_work_item(exp, dataset_example_id=1200)
        heapq.heappush(
            exp._retry_heap,
            RetryItem(
                ready_at=datetime.now(timezone.utc) + timedelta(seconds=60),
                work_item=retry_task,
            ),
        )

        run = _make_experiment_run(run_id=11, repetition_number=1)
        revision = _make_dataset_example_revision(dataset_example_id=1004)
        result = MagicMock()
        result.all.return_value = [(run, 1, revision, "[]")]
        session = MagicMock()
        session.bind = MagicMock()
        session.bind.dialect.name = "postgresql"
        session.execute = AsyncMock(return_value=result)
        exp._db = MagicMock(return_value=_AsyncSessionContext(session))

        await exp._ensure_eval_buffer()

        session.execute.assert_not_awaited()
        assert exp._backpressure_active is True

        exp._retry_heap.clear()

        await exp._ensure_eval_buffer()

        session.execute.assert_awaited_once()
        assert exp._backpressure_active is False
        assert len(exp._eval_queue) == 1

    @pytest.mark.anyio
    async def test_ensure_eval_buffer_timeout_is_non_fatal(self) -> None:
        """Eval buffer timeout is logged and retried later, not raised."""
        output_config = MagicMock()
        output_config.name = "accuracy"
        evaluator = MagicMock()
        evaluator.name = "quality-evaluator"
        spec = EvaluatorRunSpec(
            dataset_evaluator_id=90,
            evaluator=evaluator,
            input_mapping=MagicMock(),
            output_configs=[output_config],
            evaluator_project_id=1,
        )
        exp = _make_running_experiment(evaluator_run_specs=[spec])
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = False

        session = MagicMock()
        session.bind = MagicMock()
        session.bind.dialect.name = "postgresql"
        session.execute = AsyncMock(side_effect=TimeoutError())
        exp._db = MagicMock(return_value=_AsyncSessionContext(session))

        await exp._ensure_eval_buffer()

        assert exp._eval_db_exhausted is False
        assert len(exp._eval_queue) == 0

    @pytest.mark.anyio
    async def test_ensure_task_buffer_timeout_is_non_fatal(self) -> None:
        """Task buffer timeout is logged and retried later, not raised."""
        exp = _make_running_experiment()
        exp._task_db_exhausted = False
        exp._eval_db_exhausted = True
        exp._project_id = 1
        exp._experiment.repetitions = 1
        exp._experiment_job = MagicMock(spec=models.ExperimentPromptTask)

        session = MagicMock()
        session.bind = MagicMock()
        session.bind.dialect.name = "postgresql"
        session.execute = AsyncMock(side_effect=TimeoutError())
        exp._db = MagicMock(return_value=_AsyncSessionContext(session))

        await exp._ensure_task_buffer()

        assert exp._task_db_exhausted is False
        assert len(exp._task_queue) == 0

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
    async def test_on_capacity_error_retries_without_tripping_circuit_breaker(self) -> None:
        exp = _make_running_experiment()
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True
        task = _make_task_work_item(exp, dataset_example_id=1)

        await exp.on_capacity_error(task, RuntimeError("sandbox capacity is busy"))

        assert len(exp._retry_heap) == 1
        assert task.retry_count == 1
        assert not exp._task_circuit_breaker.is_tripped

    @pytest.mark.anyio
    async def test_exhausted_capacity_retries_do_not_trip_evaluator_circuit_breaker(
        self,
    ) -> None:
        exp = _make_running_experiment(max_retries=0)
        work_item = _make_eval_work_item(exp, dataset_evaluator_id=10)
        breaker = CircuitBreaker(threshold=1)
        exp._eval_circuit_breakers[work_item.dataset_evaluator_id] = breaker

        with (
            patch.object(exp, "_persist_log", new_callable=AsyncMock),
            patch.object(exp, "_persist_exhausted_retry", new_callable=AsyncMock) as persist,
            patch.object(exp, "_handle_circuit_trip", new_callable=AsyncMock) as trip,
        ):
            await exp.on_capacity_error(work_item, RuntimeError("sandbox capacity is busy"))

        persist.assert_awaited_once()
        trip.assert_not_awaited()
        assert exp._evals_failed == 1
        assert breaker._consecutive_failures == 0
        assert not breaker.is_tripped

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
# Group 5: EvalWorkItem cancellation
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


class TestEvalWorkItemCapacity:
    @pytest.mark.anyio
    async def test_monty_busy_uses_capacity_retry_path(self) -> None:
        running_experiment = _make_running_experiment()
        work_item = _make_eval_work_item(running_experiment)

        with (
            patch.object(
                work_item._evaluator,
                "evaluate",
                new=AsyncMock(side_effect=MontyBusy("sandbox is busy")),
            ),
            patch.object(
                running_experiment, "on_capacity_error", new_callable=AsyncMock
            ) as on_capacity_error,
            patch.object(running_experiment, "on_failure", new_callable=AsyncMock) as on_failure,
        ):
            await work_item.execute()

        on_capacity_error.assert_awaited_once()
        on_failure.assert_not_awaited()


# ===========================================================================
# Group 6: Graceful shutdown
# ===========================================================================


class TestGracefulShutdown:
    @pytest.mark.anyio
    async def test_graceful_shutdown_stops_all(self) -> None:
        """_graceful_shutdown calls stop() on each experiment."""

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
# Group 6b: Dispatch hand-off to worker tasks
# ===========================================================================


class TestDispatchHandOff:
    @staticmethod
    def _make_runner(exp: RunningExperiment) -> ExperimentRunner:
        runner = object.__new__(ExperimentRunner)
        runner._experiments = {exp._experiment.id: exp}
        runner._seats = anyio.Semaphore(10)
        return runner

    @pytest.mark.anyio
    async def test_hand_off_rejected_by_task_group_undoes_the_dispatch(self) -> None:
        """If the task group refuses to create the worker, the item goes back to its queue.

        A task group that is not active (never entered, or already exited) rejects
        start_soon() before any worker exists. Without the rollback the item would sit
        in the in-flight set forever: the experiment could never complete, and
        stop_experiment() would wait for a drain that never comes.
        """
        exp = _make_running_experiment()
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True
        task = _make_task_work_item(exp, dataset_example_id=1)
        exp._task_queue.append(task)
        runner = self._make_runner(exp)

        dispatched = await runner._try_get_ready_work_item()
        assert dispatched is task
        inactive_task_group = anyio.create_task_group()  # never entered

        with pytest.raises(RuntimeError):
            runner._hand_off(inactive_task_group, dispatched)

        _assert_untracked(exp, task)
        assert list(exp._task_queue) == [task]
        assert exp.has_work()

    @pytest.mark.anyio
    async def test_hand_off_into_cancelled_task_group_leaves_no_state_behind(self) -> None:
        """A worker started into a task group that is shutting down does no work.

        This is the shutdown case as it actually happens: an entered task group whose
        scope has been cancelled still accepts the worker, so there is nothing to roll
        back. The worker inherits the cancellation at the checkpoint that precedes
        execute(), so the item's work never starts, and the worker's cleanup must still
        remove every trace of the item and release the seat.
        """
        exp = _make_running_experiment()
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True
        task = _make_task_work_item(exp, dataset_example_id=1)
        exp._task_queue.append(task)
        runner = self._make_runner(exp)
        execute_entered = False

        async def execute() -> None:
            nonlocal execute_entered
            execute_entered = True

        with patch.object(task, "execute", execute):
            await runner._seats.acquire()
            dispatched = await runner._try_get_ready_work_item()
            assert dispatched is task
            async with anyio.create_task_group() as tg:
                tg.cancel_scope.cancel()  # the daemon's task group is shutting down
                runner._hand_off(tg, dispatched)  # accepted, so no rollback happens

        assert not execute_entered
        assert not exp._task_queue  # the hand-off was not undone: nothing was put back
        _assert_untracked(exp, task)
        assert runner._seats.value == 10  # ...and the worker ran its cleanup

    @pytest.mark.anyio
    async def test_stop_between_dispatch_and_worker_start_cancels_the_worker(self) -> None:
        """A worker whose experiment was stopped before it began does no work.

        The dispatch loop starts workers with start_soon(), so stop() can run after the
        item was handed off but before the worker's first step. The worker enters the
        scope that stop() already cancelled and is cancelled at the checkpoint that
        precedes execute(), so the item's work never starts. It still unregisters, so
        the experiment drains and the seat is released.
        """
        exp = _make_running_experiment()
        exp._task_db_exhausted = True
        exp._eval_db_exhausted = True
        task = _make_task_work_item(exp, dataset_example_id=1)
        exp._task_queue.append(task)
        runner = self._make_runner(exp)
        execute_entered = False

        async def execute() -> None:
            nonlocal execute_entered
            execute_entered = True

        with patch.object(task, "execute", execute):
            await runner._seats.acquire()
            dispatched = await runner._try_get_ready_work_item()
            assert dispatched is task
            async with anyio.create_task_group() as tg:
                runner._hand_off(tg, dispatched)
                exp.stop()  # the worker has not had its first step yet

        assert not execute_entered
        _assert_untracked(exp, task)
        assert exp._drained.is_set()
        assert runner._seats.value == 10


# ===========================================================================
# Group 7: Error persistence
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


# ===========================================================================
# Group 8: Evaluator tasks (the evaluator is the experiment's task)
# ===========================================================================

_ANSWER_LENGTH_SOURCE = "def evaluate(output):\n    return len(output)"

_LENGTH_CONFIG = ContinuousOutputConfig(
    type="CONTINUOUS",
    name="length",
    optimization_direction=OptimizationDirection.MAXIMIZE,
    description=None,
    lower_bound=0.0,
    upper_bound=None,
)

_CORRECTNESS_CONFIG = CategoricalOutputConfig(
    type="CATEGORICAL",
    name="correctness",
    optimization_direction=OptimizationDirection.MAXIMIZE,
    values=[
        CategoricalAnnotationValue(label="correct", score=1.0),
        CategoricalAnnotationValue(label="incorrect", score=0.0),
    ],
)

_OUTPUT_ANSWER_MAPPING = InputMapping(
    literal_mapping={}, path_mapping={"output": "$.output.answer"}
)


@dataclass(frozen=True)
class _EvaluatorExperiment:
    """An experiment over two examples whose metadata carries reviewer-recorded verdicts."""

    project: models.Project
    experiment: models.Experiment
    revisions: list[models.DatasetExampleRevision]


@pytest.fixture
async def evaluator_experiment(db: DbSessionFactory) -> _EvaluatorExperiment:
    async with db() as session:
        project = models.Project(name=f"Experiment-{token_hex(4)}")
        dataset = models.Dataset(name=f"dataset-{token_hex(4)}", metadata_={})
        session.add_all([project, dataset])
        await session.flush()
        version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add(version)
        await session.flush()
        revisions: list[models.DatasetExampleRevision] = []
        for answer in ("Paris", "Tokyo"):
            example = models.DatasetExample(
                dataset_id=dataset.id, created_at=datetime.now(timezone.utc)
            )
            session.add(example)
            await session.flush()
            revision = models.DatasetExampleRevision(
                dataset_example_id=example.id,
                dataset_version_id=version.id,
                input={"question": "Which capital?"},
                output={"answer": answer},
                # An expected output a reviewer recorded; the evaluator must never see it
                metadata_={"annotations": [{"name": "length", "score": 5.0}], "source": "unit"},
                revision_kind="CREATE",
            )
            session.add(revision)
            revisions.append(revision)
        await session.flush()
        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=version.id,
            name="answer-length",
            repetitions=1,
            metadata_={},
            project_name=project.name,
        )
        session.add(experiment)
        await session.flush()
        session.add_all(
            [
                models.ExperimentDatasetExample(
                    experiment_id=experiment.id,
                    dataset_example_id=revision.dataset_example_id,
                    dataset_example_revision_id=revision.id,
                )
                for revision in revisions
            ]
        )
    return _EvaluatorExperiment(project=project, experiment=experiment, revisions=revisions)


def _code_definition(
    name: str, output_configs: Sequence[OutputConfigType], *, sandbox_config_id: int = 1
) -> InlineCodeEvaluatorDefinition:
    return InlineCodeEvaluatorDefinition(
        type="inline_code_evaluator",
        name=name,
        description=None,
        language="PYTHON",
        source_code=_ANSWER_LENGTH_SOURCE,
        sandbox_config_id=sandbox_config_id,
        output_configs=list(output_configs),
    )


async def _create_evaluator_task(
    db: DbSessionFactory,
    experiment_id: int,
    *,
    definition: EvaluatorDefinition,
    evaluator_kind: str = "CODE",
    output_configs: Sequence[OutputConfigType] = (_LENGTH_CONFIG,),
    input_mapping: InputMapping = _OUTPUT_ANSWER_MAPPING,
) -> models.ExperimentEvaluatorTask:
    """Persist the EVALUATOR job row of an experiment and return it, detached."""
    async with db() as session:
        evaluator_task = models.ExperimentEvaluatorTask(
            id=experiment_id,
            name=Identifier(definition.name if hasattr(definition, "name") else "evaluator"),
            evaluator_kind=evaluator_kind,
            definition=definition,
            input_mapping=input_mapping,
            output_configs=list(output_configs),
        )
        session.add(evaluator_task)
    return evaluator_task


def _code_evaluator(result_text: str = "0.75") -> tuple[CodeEvaluatorRunner, AsyncMock]:
    """A code evaluator over a mocked sandbox backend that prints ``result_text``."""
    backend = AsyncMock()
    backend.execute_with_inputs = AsyncMock(
        return_value=ExecutionResult(
            stdout=f"{PHOENIX_RESULT_BEGIN}\n{result_text}\n{PHOENIX_RESULT_END}\n",
            stderr="",
            error=None,
        )
    )
    backend.close = AsyncMock(return_value=None)
    runner = CodeEvaluatorRunner(
        name="answer-length",
        description=None,
        source_code=_ANSWER_LENGTH_SOURCE,
        stored_output_configs=[_LENGTH_CONFIG],
        sandbox_backend=backend,
        language="PYTHON",
        sandbox_session_manager=None,
        timeout=30,
    )
    return runner, backend


class _FakeJudgeClient:
    """Stands in for the judge model and always votes 'correct' through the evaluator's tool."""

    def get_rate_limit_key(self) -> Hashable:
        return "fake-judge"

    def is_rate_limit_error(self, e: Exception) -> bool:
        return False

    def is_transient_error(self, e: Exception) -> bool:
        return False

    async def chat_completion_create(self, **_: Any) -> AsyncIterator[ToolCallChunk]:
        yield ToolCallChunk(
            id="call-1",
            function=FunctionCallChunk(
                name="correctness",
                arguments=json.dumps({"label": "correct", "explanation": "matches"}),
            ),
        )


def _correctness_prompt() -> tuple[PromptChatTemplate, PromptTools]:
    template = PromptChatTemplate(
        type="chat",
        messages=[PromptMessage(role="user", content="Q: {{input}}\nA: {{output}}\nCorrect?")],
    )
    tools = PromptTools(
        type="tools",
        tools=[
            PromptToolFunction(
                type="function",
                function=PromptToolFunctionDefinition(
                    name="correctness",
                    description="judges the correctness of the answer",
                    parameters={
                        "type": "object",
                        "properties": {
                            "label": {
                                "type": "string",
                                "enum": ["correct", "incorrect"],
                                "description": "correctness",
                            },
                        },
                        "required": ["label"],
                    },
                ),
            )
        ],
        tool_choice=PromptToolChoiceOneOrMore(type="one_or_more"),
    )
    return template, tools


def _running_evaluator_experiment(
    db: DbSessionFactory,
    experiment: models.Experiment,
    evaluator_task: models.ExperimentEvaluatorTask,
    evaluator: BaseEvaluator | None,
    *,
    max_retries: int = 3,
) -> RunningExperiment:
    return RunningExperiment(
        experiment=experiment,
        experiment_job=evaluator_task,
        llm_client=_NoOpLLMClient(),
        db=db,
        decrypt=lambda b: b,
        tracer_factory=lambda: Tracer(span_cost_calculator=cast(Any, MagicMock())),
        token_buckets=_StubTokenBucketRegistry(),
        on_done=_make_on_done(),
        task_evaluator=evaluator,
        max_retries=max_retries,
        base_backoff_seconds=0.01,
    )


def _drain(
    receive: MemoryObjectReceiveStream[ChatCompletionSubscriptionPayload],
) -> list[ChatCompletionSubscriptionPayload]:
    payloads: list[ChatCompletionSubscriptionPayload] = []
    while True:
        try:
            payloads.append(receive.receive_nowait())
        except anyio.WouldBlock:
            return payloads


async def _stored_run_and_annotations(
    db: DbSessionFactory, experiment_id: int
) -> tuple[models.ExperimentRun, list[models.ExperimentRunAnnotation]]:
    async with db() as session:
        runs = (
            await session.scalars(
                select(models.ExperimentRun).where(
                    models.ExperimentRun.experiment_id == experiment_id
                )
            )
        ).all()
        assert len(runs) == 1
        annotations = (
            await session.scalars(
                select(models.ExperimentRunAnnotation)
                .where(models.ExperimentRunAnnotation.experiment_run_id == runs[0].id)
                .order_by(models.ExperimentRunAnnotation.name)
            )
        ).all()
    return runs[0], list(annotations)


class TestEvaluatorTaskWorkItem:
    def test_context_hides_expected_outputs_and_starts_reference_empty(self) -> None:
        """The evaluator judges the example itself and never sees the reviewer's answer key."""
        exp = _make_running_experiment()
        revision = _make_dataset_example_revision()
        # As the span→example converter writes them: records grouped by name. The
        # ``length`` HUMAN record is this task's own expected output; the LLM record under
        # the same name and the ``tone`` annotation are what the online evaluator would
        # also see, so they stay.
        revision.metadata_ = {
            "annotations": {
                "length": [
                    {"label": "long", "score": 5.0, "annotator_kind": "HUMAN"},
                    {"label": "short", "score": 1.0, "annotator_kind": "LLM"},
                ],
                "tone": [{"label": "polite", "annotator_kind": "HUMAN"}],
            },
            "source": "unit",
        }
        evaluator_task = MagicMock(spec=models.ExperimentEvaluatorTask)
        evaluator_task.name = Identifier("length")
        evaluator_task.output_configs = [_LENGTH_CONFIG]
        work_item = EvaluatorTaskWorkItem(
            running_experiment=exp,
            experiment=exp._experiment,
            dataset_example_revision=revision,
            repetition_number=1,
            evaluator_task=evaluator_task,
            evaluator=MagicMock(spec=BaseEvaluator),
            db=exp._db,
            tracer_factory=exp._tracer_factory,
            project_id=1,
        )

        assert work_item._build_context() == {
            "input": {"question": "test"},
            "output": {"answer": "42"},
            "metadata": {
                "annotations": {
                    "length": [{"label": "short", "score": 1.0, "annotator_kind": "LLM"}],
                    "tone": [{"label": "polite", "annotator_kind": "HUMAN"}],
                },
                "source": "unit",
            },
        }

    async def test_code_evaluator_persists_run_and_annotation_and_broadcasts(
        self, db: DbSessionFactory, evaluator_experiment: _EvaluatorExperiment
    ) -> None:
        experiment, revision = evaluator_experiment.experiment, evaluator_experiment.revisions[0]
        evaluator_task = await _create_evaluator_task(
            db, experiment.id, definition=_code_definition("answer-length", [_LENGTH_CONFIG])
        )
        evaluator, backend = _code_evaluator("0.75")
        exp = _running_evaluator_experiment(db, experiment, evaluator_task, evaluator)
        receive = exp.subscribe()

        work_item = exp._create_example_work_item(
            dataset_example_revision=revision,
            repetition_number=1,
            project_id=evaluator_experiment.project.id,
        )
        assert isinstance(work_item, EvaluatorTaskWorkItem)
        await work_item.execute()

        # The evaluator was handed the example's output, mapped by the task's input mapping
        call = backend.execute_with_inputs.await_args
        assert call is not None
        assert call.kwargs["inputs"] == {"_inputs": {"output": "Paris"}}

        run, annotations = await _stored_run_and_annotations(db, experiment.id)
        assert run.error is None
        assert run.dataset_example_id == revision.dataset_example_id
        assert run.repetition_number == 1
        assert run.trace_id is not None
        verdict = run.output["task_output"]
        assert set(verdict) == {"name", "label", "score", "explanation", "metadata"}
        assert (verdict["name"], verdict["label"], verdict["score"]) == (
            "answer-length",
            None,
            0.75,
        )
        assert [(a.name, a.annotator_kind, a.score, a.trace_id) for a in annotations] == [
            ("answer-length", "CODE", 0.75, run.trace_id)
        ]
        async with db() as session:
            trace = await session.scalar(
                select(models.Trace).where(models.Trace.trace_id == run.trace_id)
            )
            assert trace is not None
            assert trace.project_rowid == evaluator_experiment.project.id

        result, chunk = _drain(receive)
        assert isinstance(result, ChatCompletionSubscriptionResult)
        assert result.experiment_run is not None
        assert result.experiment_run.id == run.id
        assert result.span is not None
        assert result.dataset_example_id == GlobalID(
            "DatasetExample", str(revision.dataset_example_id)
        )
        assert result.repetition_number == 1
        assert isinstance(chunk, EvaluationChunk)
        assert chunk.evaluator_name == "answer-length"
        assert chunk.error is None
        assert chunk.experiment_run_evaluation is not None
        assert chunk.experiment_run_evaluation.id == annotations[0].id
        assert chunk.trace is not None
        assert exp._tasks_succeeded == 1
        assert exp._tasks_failed == 0

    async def test_llm_evaluator_persists_llm_annotation(
        self, db: DbSessionFactory, evaluator_experiment: _EvaluatorExperiment
    ) -> None:
        experiment, revision = evaluator_experiment.experiment, evaluator_experiment.revisions[0]
        template, tools = _correctness_prompt()
        invocation_parameters = PromptOpenAIInvocationParameters(
            type="openai", openai=PromptOpenAIInvocationParametersContent()
        )
        definition = InlineLLMEvaluatorDefinition(
            type="inline_llm_evaluator",
            name="correctness",
            description=None,
            prompt_version=InlineLLMEvaluatorPromptVersion(
                template_format=PromptTemplateFormat.MUSTACHE,
                template=template,
                tools=tools,
                response_format=None,
                invocation_parameters=invocation_parameters,
                model_provider=ModelProvider.OPENAI,
                model_name="gpt-4",
                custom_provider_id=None,
            ),
            output_configs=[_CORRECTNESS_CONFIG],
        )
        evaluator_task = await _create_evaluator_task(
            db,
            experiment.id,
            definition=definition,
            evaluator_kind="LLM",
            output_configs=[_CORRECTNESS_CONFIG],
            input_mapping=InputMapping(
                literal_mapping={}, path_mapping={"input": "$.input", "output": "$.output"}
            ),
        )
        evaluator = LLMEvaluator(
            name="correctness",
            description=None,
            template=template,
            template_format=PromptTemplateFormat.MUSTACHE,
            tools=tools,
            invocation_parameters=invocation_parameters,
            model_provider=ModelProvider.OPENAI,
            llm_client=cast(Any, _FakeJudgeClient()),
            output_configs=[_CORRECTNESS_CONFIG],
            prompt_name="correctness",
        )
        exp = _running_evaluator_experiment(db, experiment, evaluator_task, evaluator)
        receive = exp.subscribe()

        work_item = exp._create_example_work_item(
            dataset_example_revision=revision,
            repetition_number=1,
            project_id=evaluator_experiment.project.id,
        )
        await work_item.execute()

        run, annotations = await _stored_run_and_annotations(db, experiment.id)
        assert run.error is None
        assert run.output["task_output"]["label"] == "correct"
        assert [
            (a.name, a.annotator_kind, a.label, a.score, a.explanation) for a in annotations
        ] == [("correctness", "LLM", "correct", 1.0, "matches")]
        result, chunk = _drain(receive)
        assert isinstance(result, ChatCompletionSubscriptionResult)
        assert isinstance(chunk, EvaluationChunk)
        assert chunk.evaluator_name == "correctness"
        assert exp._tasks_succeeded == 1

    async def test_evaluator_exception_persists_errored_run_and_annotation(
        self, db: DbSessionFactory, evaluator_experiment: _EvaluatorExperiment
    ) -> None:
        experiment, revision = evaluator_experiment.experiment, evaluator_experiment.revisions[0]
        evaluator_task = await _create_evaluator_task(
            db, experiment.id, definition=_code_definition("answer-length", [_LENGTH_CONFIG])
        )
        evaluator = MagicMock(spec=BaseEvaluator)
        evaluator.evaluate = AsyncMock(side_effect=RuntimeError("sandbox exploded"))
        exp = _running_evaluator_experiment(db, experiment, evaluator_task, evaluator)
        receive = exp.subscribe()

        work_item = exp._create_example_work_item(
            dataset_example_revision=revision,
            repetition_number=1,
            project_id=evaluator_experiment.project.id,
        )
        await work_item.execute()

        run, annotations = await _stored_run_and_annotations(db, experiment.id)
        assert run.error == "sandbox exploded"
        assert run.output == {}
        assert [(a.name, a.annotator_kind, a.error, a.label, a.score) for a in annotations] == [
            ("answer-length", "CODE", "sandbox exploded", None, None)
        ]
        error, chunk = _drain(receive)
        assert isinstance(error, ChatCompletionSubscriptionError)
        assert error.message == "sandbox exploded"
        assert error.experiment_run is not None
        assert error.experiment_run.id == run.id
        assert isinstance(chunk, EvaluationChunk)
        assert chunk.error == "sandbox exploded"
        assert chunk.experiment_run_evaluation is None
        assert exp._tasks_failed == 1
        assert exp._tasks_succeeded == 0

    async def test_evaluator_reported_error_is_an_errored_run(
        self, db: DbSessionFactory, evaluator_experiment: _EvaluatorExperiment
    ) -> None:
        """An error the evaluator returns (not raises) still lands as an errored run."""
        experiment, revision = evaluator_experiment.experiment, evaluator_experiment.revisions[0]
        evaluator_task = await _create_evaluator_task(
            db, experiment.id, definition=_code_definition("answer-length", [_LENGTH_CONFIG])
        )
        now = datetime.now(timezone.utc)
        error_result: EvaluationResult = {
            "name": "answer-length",
            "annotator_kind": "CODE",
            "label": None,
            "score": None,
            "explanation": None,
            "metadata": {},
            "error": "Input mapping failed: output",
            "trace_id": None,
            "start_time": now,
            "end_time": now,
        }
        evaluator = MagicMock(spec=BaseEvaluator)
        evaluator.evaluate = AsyncMock(return_value=[error_result])
        exp = _running_evaluator_experiment(db, experiment, evaluator_task, evaluator)
        receive = exp.subscribe()

        work_item = exp._create_example_work_item(
            dataset_example_revision=revision,
            repetition_number=1,
            project_id=evaluator_experiment.project.id,
        )
        await work_item.execute()

        run, annotations = await _stored_run_and_annotations(db, experiment.id)
        assert run.error == "Input mapping failed: output"
        assert run.output == {}
        assert [(a.name, a.error) for a in annotations] == [
            ("answer-length", "Input mapping failed: output")
        ]
        error, chunk = _drain(receive)
        assert isinstance(error, ChatCompletionSubscriptionError)
        assert error.message == "Input mapping failed: output"
        assert isinstance(chunk, EvaluationChunk)
        assert chunk.error == "Input mapping failed: output"
        assert exp._tasks_failed == 1

    async def test_exhausted_retries_persist_errored_run_and_annotation(
        self, db: DbSessionFactory, evaluator_experiment: _EvaluatorExperiment
    ) -> None:
        experiment, revision = evaluator_experiment.experiment, evaluator_experiment.revisions[0]
        evaluator_task = await _create_evaluator_task(
            db, experiment.id, definition=_code_definition("answer-length", [_LENGTH_CONFIG])
        )
        evaluator, _ = _code_evaluator()
        exp = _running_evaluator_experiment(
            db, experiment, evaluator_task, evaluator, max_retries=0
        )
        receive = exp.subscribe()
        work_item = exp._create_example_work_item(
            dataset_example_revision=revision,
            repetition_number=1,
            project_id=evaluator_experiment.project.id,
        )

        await exp._retry_or_fail(work_item, "timeout")

        run, annotations = await _stored_run_and_annotations(db, experiment.id)
        assert run.error == "timeout after 0 retries"
        assert [(a.name, a.error) for a in annotations] == [
            ("answer-length", "timeout after 0 retries")
        ]
        error, chunk = _drain(receive)
        assert isinstance(error, ChatCompletionSubscriptionError)
        assert error.message == "timeout after 0 retries"
        assert isinstance(chunk, EvaluationChunk)
        assert chunk.evaluator_name == "answer-length"
        assert chunk.error == "timeout after 0 retries"
        assert exp._tasks_failed == 1


class TestEvaluatorExperimentResume:
    async def test_ensure_task_buffer_queues_only_incomplete_examples(
        self, db: DbSessionFactory, evaluator_experiment: _EvaluatorExperiment
    ) -> None:
        """Resuming a half-finished evaluator experiment queues the examples without a run."""
        experiment, revisions = evaluator_experiment.experiment, evaluator_experiment.revisions
        evaluator_task = await _create_evaluator_task(
            db, experiment.id, definition=_code_definition("answer-length", [_LENGTH_CONFIG])
        )
        now = datetime.now(timezone.utc)
        async with db() as session:
            session.add(
                models.ExperimentRun(
                    experiment_id=experiment.id,
                    dataset_example_id=revisions[0].dataset_example_id,
                    repetition_number=1,
                    output={"task_output": {"name": "answer-length", "score": 5.0}},
                    start_time=now,
                    end_time=now,
                    error=None,
                    trace_id=None,
                )
            )
        evaluator, _ = _code_evaluator()
        exp = _running_evaluator_experiment(db, experiment, evaluator_task, evaluator)

        await exp._ensure_task_buffer()

        assert exp._task_db_exhausted is True
        queued = list(exp._task_queue)
        assert len(queued) == 1
        assert isinstance(queued[0], EvaluatorTaskWorkItem)
        assert (
            queued[0].dataset_example_revision.dataset_example_id == revisions[1].dataset_example_id
        )
        assert queued[0].repetition_number == 1
        assert queued[0].evaluator is evaluator

    async def test_ensure_task_buffer_dispatches_nothing_without_a_task_evaluator(
        self, db: DbSessionFactory, evaluator_experiment: _EvaluatorExperiment
    ) -> None:
        experiment = evaluator_experiment.experiment
        evaluator_task = await _create_evaluator_task(
            db, experiment.id, definition=_code_definition("answer-length", [_LENGTH_CONFIG])
        )
        exp = _running_evaluator_experiment(db, experiment, evaluator_task, None)

        await exp._ensure_task_buffer()

        assert exp._task_db_exhausted is True
        assert not exp._task_queue


class TestLoadEvaluatorTaskConfig:
    async def test_rebuilds_the_evaluator_from_its_frozen_definition(
        self, db: DbSessionFactory, evaluator_experiment: _EvaluatorExperiment
    ) -> None:
        experiment = evaluator_experiment.experiment
        async with db() as session:
            sandbox_config = models.SandboxConfig(
                backend_type="WASM",
                language="PYTHON",
                name=Identifier("wasm-python"),
                description=None,
                config={},
                timeout=30,
            )
            session.add(sandbox_config)
            await session.flush()
            sandbox_config_id = sandbox_config.id
        await _create_evaluator_task(
            db,
            experiment.id,
            definition=_code_definition(
                "answer-length", [_LENGTH_CONFIG], sandbox_config_id=sandbox_config_id
            ),
        )
        runner = ExperimentRunner(
            db,
            decrypt=lambda b: b,
            tracer_factory=lambda: Tracer(span_cost_calculator=cast(Any, MagicMock())),
            sandbox_session_manager=cast(Any, MagicMock(replica_id="replica-1")),
            sandbox_runtime=cast(Any, MagicMock()),
        )

        with patch(
            "phoenix.server.api.evaluators.build_sandbox_backend",
            return_value=MagicMock(),
        ):
            async with db() as session:
                job, llm_client, specs, evaluator = await runner._load_experiment_config(
                    session, experiment.id, credentials=None
                )

        assert isinstance(job, models.ExperimentEvaluatorTask)
        assert job.name == Identifier("answer-length")
        assert llm_client is _NO_OP_LLM_CLIENT
        assert specs == []
        assert isinstance(evaluator, CodeEvaluatorRunner)
        assert evaluator.name == "answer-length"
        assert list(evaluator.output_configs) == [_LENGTH_CONFIG]
