"""
Background experiment runner daemon.

This module runs experiments end-to-end in the background. It combines:

- a daemon-level scheduler across active experiments
- a per-experiment state machine for queueing, retries, and cancellation
- self-executing work-item objects for tasks and evaluations

Key objects
-----------
- ExperimentRunner
  - Global coordinator for claim/resume, fairness, dispatch, and shutdown.
- RunningExperiment
  - Per-experiment mutable state: task queue, eval queue, retry heap,
    in-flight tracking, DB cursors, and subscriber streams.
- TaskWorkItem / EvalWorkItem
  - Command-style objects that execute one logical unit and report outcomes
    back to their owning RunningExperiment.

Dispatch model
--------------
1. Claim an experiment row from DB and create RunningExperiment.
2. Acquire a global concurrency seat (semaphore) before selecting work.
   Why: this bounds global concurrency at selection time and avoids choosing
   work that cannot run yet.
3. Refill DB-backed buffers as needed, then choose work by priority:
   eval queue > ready retries > task queue.
   Why: evaluator output is user-visible feedback, so evals are prioritized for
   freshness; ready retries are prioritized over new tasks to honor backoff.
4. If the chosen item is rate-limited, skip it without blocking the daemon so
   another experiment can run.
5. Execute inside _run_and_release (register cancel scope, execute, unregister,
   release semaphore seat).

Two-phase sequencing
--------------------
The runner uses explicit phases per experiment:

1) Initial eval reconciliation phase
   - _ensure_eval_buffer scans persisted successful task runs that are missing
     successful eval annotations and enqueues eval work.
   - This scan is pagination-based over experiment_run.id and runs to
     exhaustion.
   - Task DB scanning is disabled during this phase.
2) Task phase
   - After the initial eval scan is exhausted, _ensure_task_buffer starts
     producing task work.
   - on_task_success reactively enqueues eval work for newly successful tasks.

Why this sequencing exists:
- It avoids producer overlap between reconciliation and task-driven reactive
  eval production.
- It makes phase transition explicit: transition occurs when the initial eval scan
  reaches DB exhaustion (not when eval queue/retries drain).
- For EVAL_ONLY experiments, phase 1 may be empty, and phase 2 has no producer.

Retries and completion behavior
-------------------------------
- Retryable errors (timeout, rate limit, transient failures) use exponential
  backoff in a min-heap (RetryItem).
- Completion is data-driven from queues, retries, in-flight work, and DB
  exhaustion flags.
- stop() performs in-memory cancellation/cleanup only; queue state is transient
  and reconstructed from DB on resume.
- on_done stop-state DB update is best-effort. If it fails, stale-claim/orphan
  recovery provides eventual convergence of ownership/status.
  Why: this avoids coupling completion teardown to in-memory retry orchestration
  while preserving eventual DB-state correctness.
"""

from __future__ import annotations

import heapq
import json
import logging
import random
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import cached_property
from secrets import token_hex
from typing import (
    TYPE_CHECKING,
    Any,
    AsyncIterator,
    Callable,
    Hashable,
    Literal,
    Mapping,
    Protocol,
    Sequence,
    overload,
)

import anyio
from anyio import Semaphore
from anyio.streams.memory import MemoryObjectReceiveStream, MemoryObjectSendStream
from cachetools import LRUCache
from opentelemetry.context import Context as OtelContext
from sqlalchemy import delete, or_, select, update
from sqlalchemy.exc import SQLAlchemyError
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, override

from phoenix.config import EXPERIMENT_STALE_CLAIM_TIMEOUT
from phoenix.db import models
from phoenix.db.helpers import (
    SupportedSQLDialect,
    get_experiment_incomplete_runs_query,
    get_runs_with_incomplete_evaluations_query,
)
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.experiment_log import (
    FailureDetail,
    RetriesExhaustedDetail,
)
from phoenix.db.types.prompts import PromptChatTemplate, get_raw_invocation_parameters
from phoenix.server.api.evaluators import (
    BaseEvaluator,
    LLMEvaluator,
    evaluation_result_to_model,
    get_evaluators,
)
from phoenix.server.api.helpers.message_helpers import (
    build_template_variables,
    extract_and_convert_example_messages,
    formatted_messages,
    prompt_chat_template_to_playground_messages,
)
from phoenix.server.api.helpers.playground_clients import get_playground_client
from phoenix.server.api.helpers.playground_experiment_runs import (
    get_db_experiment_run,
)
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionPayload,
    ChatCompletionSubscriptionResult,
    EvaluationChunk,
)
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.Trace import Trace
from phoenix.server.rate_limiters import AdaptiveTokenBucket, UnavailableTokensError
from phoenix.server.types import DaemonTask, DbSessionFactory
from phoenix.utilities.template_formatters import TemplateFormatterError

if TYPE_CHECKING:
    from opentelemetry.context import Context
    from sqlalchemy.ext.asyncio import AsyncSession

    from phoenix.db.types.prompts import PromptResponseFormat, PromptTools
    from phoenix.server.api.helpers.message_helpers import PlaygroundMessage
    from phoenix.server.api.helpers.playground_clients import ChatCompletionChunk
    from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
    from phoenix.tracers import Tracer


class TokenBucket(Protocol):
    def on_rate_limit_error(self, request_start_time: float, verbose: bool = False) -> None: ...
    def make_request_if_ready(self) -> None: ...


class _NoOpTokenBucket:
    def on_rate_limit_error(self, request_start_time: float, verbose: bool = False) -> None: ...
    def make_request_if_ready(self) -> None: ...


_NO_OP_TOKEN_BUCKET = _NoOpTokenBucket()


def _sanitize_error_message(error: BaseException) -> str:
    """Return a user-safe error summary: exception class name only.

    Raw ``str(error)`` can leak internal paths, API keys, or other
    sensitive details embedded by third-party SDKs.  We keep the
    exception class name (e.g. ``TimeoutError``, ``RateLimitError``)
    which is enough for users to understand what went wrong without
    exposing internals.  The full detail is still available in the
    server logs.
    """
    return type(error).__name__


class LLMClient(Protocol):
    """Narrow interface for the LLM client methods the runner actually uses.

    PlaygroundStreamingClient satisfies this implicitly.  The Protocol
    decouples the runner from the ~20-method ABC and enables _NoOpLLMClient
    for EVAL_ONLY experiments.
    """

    def get_rate_limit_key(self) -> Hashable: ...
    def is_rate_limit_error(self, e: Exception) -> bool: ...
    def is_transient_error(self, e: Exception) -> bool: ...
    def chat_completion_create(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None = None,
        invocation_parameters: Mapping[str, Any] = ...,
        tracer: Tracer | None = None,
        otel_context: Context | None = None,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]: ...


class _NoOpLLMClient:
    """Sentinel for EVAL_ONLY experiments — raises if any method is called."""

    _ERR = "LLM client not available (EVAL_ONLY experiment)"

    def get_rate_limit_key(self) -> Hashable:
        raise RuntimeError(self._ERR)

    def is_rate_limit_error(self, e: Exception) -> bool:
        raise RuntimeError(self._ERR)

    def is_transient_error(self, e: Exception) -> bool:
        raise RuntimeError(self._ERR)

    async def chat_completion_create(
        self,
        *,
        messages: Sequence[PlaygroundMessage],
        tools: PromptTools | None,
        response_format: PromptResponseFormat | None = None,
        invocation_parameters: Mapping[str, Any] | None = None,
        tracer: Tracer | None = None,
        otel_context: Context | None = None,
        stream_model_output: bool = True,
    ) -> AsyncIterator[ChatCompletionChunk]:
        raise RuntimeError(self._ERR)
        yield  # make it an async generator  # pragma: no cover


_NO_OP_LLM_CLIENT = _NoOpLLMClient()


def _output_configs_for_eval_run(
    dataset_evaluator: models.DatasetEvaluators,
    evaluator: BaseEvaluator,
) -> list[OutputConfigType]:
    """Configs for EvalWorkItem.evaluate.

    Annotation and subscription chunk names come from each output config's ``name``.
    Prefer ``dataset_evaluators.output_configs`` from the database; fall back to the
    hydrated evaluator only when the row has no stored configs.
    """
    if dataset_evaluator.output_configs:
        return list(dataset_evaluator.output_configs)
    return list(evaluator.output_configs)


@dataclass(frozen=True)
class EvaluatorRunSpec:
    """Resolved evaluator inputs for one dataset evaluator at experiment start."""

    dataset_evaluator_id: int
    evaluator: BaseEvaluator
    input_mapping: InputMapping
    output_configs: Sequence[OutputConfigType]
    # DatasetEvaluators.project_id — traces for this eval are recorded under this project
    evaluator_project_id: int


class TokenBucketRegistry(Protocol):
    """Read-only interface for accessing rate limit buckets by key."""

    def __getitem__(self, key: Hashable) -> TokenBucket: ...


class AutoCreateTokenBucketRegistry:
    """LRU cache that auto-creates AdaptiveTokenBucket on access."""

    def __init__(self, maxsize: int = 100) -> None:
        self._cache: LRUCache[Hashable, TokenBucket] = LRUCache(maxsize=maxsize)

    def __getitem__(self, key: Hashable) -> TokenBucket:
        if key is _NO_OP_TOKEN_BUCKET:
            return _NO_OP_TOKEN_BUCKET
        if key not in self._cache:
            self._cache[key] = AdaptiveTokenBucket(
                initial_per_second_request_rate=5.0,
                cooldown_seconds=0,
            )
        return self._cache[key]


logger = logging.getLogger(__name__)

ExperimentId: TypeAlias = int

# =============================================================================
# Work Items (Command Pattern)
# =============================================================================


class WorkItem(ABC):
    """
    Base class for self-executing work items.

    Work items are Commands (Gang of Four pattern) - they carry everything needed
    for execution and report results to their owning RunningExperiment.

    execute() follows a consistent structure across subclasses:

      try:    Run the external call (LLM / evaluator). Nothing else.
      except: Classify the error:
              - Rate limit    → delegate to RunningExperiment (retry or exhaust)
              - Transient     → delegate to RunningExperiment (retry or exhaust)
              - Permanent     → persist error record to DB, broadcast, on_failure
              - Timeout       → delegate to RunningExperiment (retry or exhaust)
              - Cancelled     → re-raise (let the runner handle it)
      else:   Persist results to DB, broadcast, report success. DB persist
              failures feed the circuit breaker via on_failure (to avoid
              wasting LLM calls when the DB is down).

    Two kinds of terminal outcomes and who owns them:

      Work item determines: permanent errors, template errors, success.
        → Work item persists DB records and broadcasts to UI.
      RunningExperiment determines: retry exhaustion, circuit breaker trips.
        → RunningExperiment persists DB records and broadcasts to UI.

    Key invariant: every terminal outcome must produce a DB record. No silent drops.

    on_failure is purely bookkeeping: failure counters, logging, circuit breakers.
    """

    # Owner - reports results back to this experiment
    _running_experiment: RunningExperiment
    retry_count: int = 0

    @cached_property
    def running_experiment(self) -> RunningExperiment:
        """Owning experiment; reports results back to this."""
        return self._running_experiment

    @property
    @abstractmethod
    def debug_identifier(self) -> str:
        """Human-readable identifier for logging."""
        ...

    @property
    @abstractmethod
    def experiment_id(self) -> ExperimentId:
        """Return the experiment ID this work item belongs to."""
        ...

    @abstractmethod
    async def execute(self) -> None:
        """Execute this work item. Results reported to owning RunningExperiment."""
        ...

    @abstractmethod
    def get_rate_limit_key(self) -> Hashable:
        """Return the rate limit key for this work item's LLM client."""
        ...


class TaskWorkItem(WorkItem):
    """
    Task work item: run LLM completion for one dataset example x one repetition.

    Carries everything needed for execution:
    - Data: example input, repetition number, messages
    - Config: prompt_version for creating client on demand
    - Behavior: timeout, db, decrypt
    - RunningExperiment reference for reporting results
    """

    def __init__(
        self,
        *,
        # Owner - reports results back to this experiment
        running_experiment: RunningExperiment,
        # Identity
        experiment: models.Experiment,
        dataset_example_revision: models.DatasetExampleRevision,
        repetition_number: int,
        # Execution context
        prompt_task: models.ExperimentPromptTask,
        llm_client: LLMClient,
        db: DbSessionFactory,
        decrypt: Callable[[bytes], bytes],
        tracer_factory: Callable[[], Tracer],
        project_id: int,
        # Optional parameters with defaults
        credentials: Sequence[GenerativeCredentialInput] | None = None,
        timeout: float = 120.0,
        retry_count: int = 0,
    ) -> None:
        # Owner (private; base class and _run_and_release use _running_experiment)
        self._running_experiment = running_experiment

        # Identity
        self._experiment = experiment
        self._dataset_example_revision = dataset_example_revision
        self._repetition_number = repetition_number

        # Execution context
        self._prompt_task = prompt_task
        self._llm_client = llm_client
        self._db = db
        self._decrypt = decrypt
        self._tracer_factory = tracer_factory
        self._project_id = project_id
        self._credentials = credentials
        self._timeout = timeout

        # Retry tracking
        self.retry_count = retry_count

    @cached_property
    def dataset_example_revision(self) -> models.DatasetExampleRevision:
        """Dataset example revision this task runs for."""
        return self._dataset_example_revision

    @cached_property
    def repetition_number(self) -> int:
        """Repetition index for this task (1-based)."""
        return self._repetition_number

    @cached_property
    def debug_identifier(self) -> str:
        return (
            f"task:experiment_id={self._experiment.id}, "
            f"dataset_example_id={self._dataset_example_revision.dataset_example_id}, "
            f"repetition={self._repetition_number}"
        )

    @cached_property
    def experiment_id(self) -> int:
        return self._experiment.id

    @override
    def get_rate_limit_key(self) -> Hashable:
        """Return the rate limit key for this work item's LLM client."""
        return self._llm_client.get_rate_limit_key()

    def _build_messages(self) -> list[PlaygroundMessage]:
        """Format prompt template with dataset example data and return messages.

        Raises TemplateFormatterError, KeyError, TypeError, or ValueError
        on template/variable resolution failures.
        """
        revision = self._dataset_example_revision
        playground_config = self._prompt_task.playground_config
        template_variables_path = (
            playground_config.template_variables_path if playground_config else None
        )
        appended_messages_path = (
            playground_config.appended_messages_path if playground_config else None
        )
        template = self._prompt_task.template
        if not isinstance(template, PromptChatTemplate):
            raise ValueError(f"Expected chat template, got {type(template).__name__}")
        messages = prompt_chat_template_to_playground_messages(template)
        template_variables = build_template_variables(
            input_data=revision.input,
            output_data=revision.output,
            metadata=revision.metadata_,
            template_variables_path=template_variables_path,
        )
        messages = list(
            formatted_messages(
                messages=messages,
                template_format=self._prompt_task.template_format,
                template_variables=template_variables,
            )
        )
        if appended_messages_path:
            appended = extract_and_convert_example_messages(revision.input, appended_messages_path)
            messages.extend(appended)
        return messages

    async def _persist_run(
        self,
        db_run: models.ExperimentRun,
        db_traces: Sequence[models.Trace] | None = None,
    ) -> models.ExperimentRun:
        """Upsert an experiment run (and optional traces) to the database.

        Returns the persisted ExperimentRun with its generated id.
        """
        with anyio.fail_after(5, shield=True):
            async with self._db() as session:
                if db_traces:
                    session.add_all(db_traces)
                stmt = insert_on_conflict(
                    {
                        "experiment_id": db_run.experiment_id,
                        "dataset_example_id": db_run.dataset_example_id,
                        "trace_id": db_run.trace_id,
                        "output": db_run.output,
                        "repetition_number": db_run.repetition_number,
                        "start_time": db_run.start_time,
                        "end_time": db_run.end_time,
                        "error": db_run.error,
                        "prompt_token_count": db_run.prompt_token_count,
                        "completion_token_count": db_run.completion_token_count,
                    },
                    table=models.ExperimentRun,
                    dialect=self._db.dialect,
                    unique_by=[
                        "experiment_id",
                        "dataset_example_id",
                        "repetition_number",
                    ],
                    on_conflict=OnConflict.DO_UPDATE,
                ).returning(models.ExperimentRun)
                result = await session.scalar(stmt)
                assert result is not None
                return result

    @override
    async def execute(self) -> None:
        """Execute the task, write to DB, and report results."""
        logger.debug(f"TaskWorkItem {self.debug_identifier} starting execution")
        tracer = self._tracer_factory()
        example_id = GlobalID(
            DatasetExample.__name__,
            str(self._dataset_example_revision.dataset_example_id),
        )
        revision = self._dataset_example_revision
        format_start_time = datetime.now(timezone.utc)
        try:
            messages = self._build_messages()
        except (TemplateFormatterError, KeyError, TypeError, ValueError) as error:
            format_end_time = datetime.now(timezone.utc)
            db_run = models.ExperimentRun(
                experiment_id=self._experiment.id,
                dataset_example_id=revision.dataset_example_id,
                trace_id=None,
                output={},
                repetition_number=self._repetition_number,
                start_time=format_start_time,
                end_time=format_end_time,
                error=str(error),
                trace=None,
            )
            try:
                db_run = await self._persist_run(db_run)
            except Exception as persist_err:
                logger.warning(
                    f"TaskWorkItem {self.debug_identifier}: "
                    f"failed to persist template error run to DB",
                    exc_info=True,
                )
                await self._running_experiment.on_failure(self, persist_err)
                return

            self._running_experiment._broadcast(
                ChatCompletionSubscriptionError(
                    message=str(error),
                    dataset_example_id=example_id,
                    repetition_number=self._repetition_number,
                    experiment_run=ExperimentRun(id=db_run.id, db_record=db_run),
                )
            )
            await self._running_experiment.on_failure(self, error)
            return

        try:
            logger.debug(
                f"TaskWorkItem {self.debug_identifier}: "
                f"starting streaming (timeout={self._timeout}s)"
            )
            with anyio.fail_after(self._timeout):
                async for chunk in self._llm_client.chat_completion_create(
                    messages=messages,
                    tools=self._prompt_task.tools,
                    response_format=self._prompt_task.response_format,
                    invocation_parameters=get_raw_invocation_parameters(
                        self._prompt_task.invocation_parameters
                    ),
                    tracer=tracer,
                    otel_context=OtelContext(),
                    stream_model_output=self._prompt_task.stream_model_output,
                ):
                    chunk.dataset_example_id = example_id
                    chunk.repetition_number = self._repetition_number
                    self._running_experiment._broadcast(chunk)

        except TimeoutError:
            logger.warning(f"TaskWorkItem {self.debug_identifier} timed out")
            await self._running_experiment.on_timeout(self)

        except anyio.get_cancelled_exc_class():
            logger.debug(f"TaskWorkItem {self.debug_identifier} cancelled")
            raise

        except Exception as e:
            err_type = type(e).__name__
            if self._is_rate_limit_error(e):
                logger.debug(f"TaskWorkItem {self.debug_identifier} hit rate limit ({err_type})")
                await self._running_experiment.on_rate_limit(self)
            elif self._is_transient_error(e):
                logger.warning(
                    f"TaskWorkItem {self.debug_identifier} transient error ({err_type}): {e}"
                )
                await self._running_experiment.on_transient_error(self, e)
            else:
                logger.exception(f"TaskWorkItem {self.debug_identifier} failed ({err_type}): {e}")
                error_end_time = datetime.now(timezone.utc)
                task_db_traces = tracer.get_db_traces(project_id=self._project_id)
                task_db_trace = task_db_traces[0] if task_db_traces else None
                db_run = models.ExperimentRun(
                    experiment_id=self._experiment.id,
                    dataset_example_id=revision.dataset_example_id,
                    trace_id=task_db_trace.trace_id if task_db_trace is not None else None,
                    output={},
                    repetition_number=self._repetition_number,
                    start_time=format_start_time,
                    end_time=error_end_time,
                    error=str(e),
                )
                try:
                    db_run = await self._persist_run(
                        db_run,
                        db_traces=task_db_traces if task_db_trace is not None else None,
                    )
                except Exception as persist_err:
                    logger.warning(
                        f"TaskWorkItem {self.debug_identifier}: failed to persist error run to DB",
                        exc_info=True,
                    )
                    await self._running_experiment.on_failure(self, persist_err)
                    return

                error_db_span = (
                    task_db_trace.spans[0]
                    if task_db_trace is not None and task_db_trace.spans
                    else None
                )
                self._running_experiment._broadcast(
                    ChatCompletionSubscriptionError(
                        message=str(e),
                        dataset_example_id=example_id,
                        repetition_number=self._repetition_number,
                        span=(
                            Span(id=error_db_span.id, db_record=error_db_span)
                            if error_db_span is not None
                            else None
                        ),
                        experiment_run=ExperimentRun(id=db_run.id, db_record=db_run),
                    )
                )
                await self._running_experiment.on_failure(self, e)

        else:
            logger.debug(f"TaskWorkItem {self.debug_identifier}: stream finished, building traces")
            task_db_traces = tracer.get_db_traces(project_id=self._project_id)
            task_db_trace = task_db_traces[0] if task_db_traces else None
            db_span = (
                task_db_trace.spans[0]
                if task_db_trace is not None and task_db_trace.spans
                else None
            )
            if db_span is not None and task_db_trace is not None:
                db_run = get_db_experiment_run(
                    db_span,
                    task_db_trace,
                    experiment_id=self._experiment.id,
                    example_id=self._dataset_example_revision.dataset_example_id,
                    repetition_number=self._repetition_number,
                )
            else:
                logger.warning(
                    f"TaskWorkItem {self.debug_identifier}: no trace recorded "
                    "(stream may have completed without emitting spans)"
                )
                db_run = models.ExperimentRun(
                    experiment_id=self._experiment.id,
                    dataset_example_id=revision.dataset_example_id,
                    trace_id=None,
                    output={},
                    repetition_number=self._repetition_number,
                    start_time=format_start_time,
                    end_time=datetime.now(timezone.utc),
                    error=None,
                    trace=None,
                )
            try:
                db_run = await self._persist_run(
                    db_run, db_traces=task_db_traces if task_db_trace is not None else None
                )
            except Exception as persist_err:
                logger.warning(
                    f"TaskWorkItem {self.debug_identifier}: failed to persist run to DB",
                    exc_info=True,
                )
                await self._running_experiment.on_failure(self, persist_err)
                return

            self._running_experiment._broadcast(
                ChatCompletionSubscriptionResult(
                    span=(Span(id=db_span.id, db_record=db_span) if db_span is not None else None),
                    experiment_run=ExperimentRun(id=db_run.id, db_record=db_run),
                    dataset_example_id=example_id,
                    repetition_number=self._repetition_number,
                )
            )

            logger.debug(f"TaskWorkItem {self.debug_identifier} completed successfully")
            await self._running_experiment.on_task_success(self, db_run)

    def _is_rate_limit_error(self, e: Exception) -> bool:
        """Check if exception is a rate limit error using client's provider-specific logic."""
        return bool(self._llm_client.is_rate_limit_error(e))

    def _is_transient_error(self, e: Exception) -> bool:
        """Check if exception is a transient/network error (should retry with backoff)."""
        if isinstance(e, SQLAlchemyError):
            return True
        return bool(self._llm_client.is_transient_error(e))


class EvalWorkItem(WorkItem):
    """
    Eval work item: run one evaluator on one task result.

    No streaming - evaluators run silently.
    Results written to experiment_run_annotations table.
    """

    def __init__(
        self,
        *,
        # Owner - reports results back to this experiment
        running_experiment: RunningExperiment,
        # Identity
        experiment_run: models.ExperimentRun,
        dataset_example_revision: models.DatasetExampleRevision,
        dataset_evaluator_id: int,
        # Evaluator config
        evaluator: BaseEvaluator,
        # Execution context
        db: DbSessionFactory,
        tracer_factory: Callable[[], Tracer],
        project_id: int,
        # Optional parameters with defaults
        input_mapping: InputMapping,
        output_configs: Sequence[OutputConfigType],
        timeout: float = 60.0,
        retry_count: int = 0,
    ) -> None:
        # Owner
        self._running_experiment = running_experiment

        # Identity
        self._experiment_run = experiment_run
        self._dataset_example_revision = dataset_example_revision
        self._dataset_evaluator_id = dataset_evaluator_id

        # Evaluator config
        self._evaluator = evaluator
        self._input_mapping = input_mapping
        self._output_configs = output_configs

        # Execution context
        self._db = db
        self._tracer_factory = tracer_factory
        self._project_id = project_id
        self._timeout = timeout

        # Retry tracking
        self.retry_count = retry_count

    @cached_property
    def dataset_evaluator_id(self) -> int:
        return self._dataset_evaluator_id

    @cached_property
    def dataset_example_revision(self) -> models.DatasetExampleRevision:
        """Dataset example revision this eval runs for."""
        return self._dataset_example_revision

    @cached_property
    def experiment_run(self) -> models.ExperimentRun:
        """Experiment run this eval annotates."""
        return self._experiment_run

    @cached_property
    def evaluator(self) -> BaseEvaluator:
        return self._evaluator

    @cached_property
    def debug_identifier(self) -> str:
        return (
            f"eval:experiment_id={self._experiment_run.experiment_id}, "
            f"run_id={self._experiment_run.id}, evaluator_name={self._evaluator.name}"
        )

    @cached_property
    def experiment_id(self) -> ExperimentId:
        return self._experiment_run.experiment_id

    @override
    def get_rate_limit_key(self) -> Hashable:
        """Return the rate limit key for this work item's evaluator.

        For LLM evaluators, delegates to the LLM client's rate limit key.
        For built-in evaluators (which run locally), returns a unique key
        so they can run without external rate limiting.
        """

        if isinstance(self._evaluator, LLMEvaluator):
            return self._evaluator.llm_client.get_rate_limit_key()
        return _NO_OP_TOKEN_BUCKET

    @override
    async def execute(self) -> None:
        """Execute the evaluation, write to DB, and report results."""
        logger.debug(f"EvalWorkItem {self.debug_identifier}: starting (timeout={self._timeout}s)")
        tracer = self._tracer_factory()
        try:
            with anyio.fail_after(self._timeout):
                context_dict: dict[str, Any] = {
                    "input": self._dataset_example_revision.input,
                    "reference": self._dataset_example_revision.output,
                    "output": self._experiment_run.output.get("task_output"),
                    "metadata": self._dataset_example_revision.metadata_,
                }
                eval_results = await self._evaluator.evaluate(
                    context=context_dict,
                    input_mapping=self._input_mapping,
                    name=self._output_configs[0].name,
                    output_configs=self._output_configs,
                    tracer=tracer,
                )
                logger.debug(
                    f"EvalWorkItem {self.debug_identifier}: evaluator returned "
                    f"{len(eval_results)} result(s)"
                )
                db_traces: list[models.Trace] = list(
                    tracer.get_db_traces(project_id=self._project_id)
                )
                annotations: list[models.ExperimentRunAnnotation] = []
                seen_names: set[str] = set()
                for result in eval_results:
                    annotation = evaluation_result_to_model(
                        result,
                        experiment_run_id=self._experiment_run.id,
                    )
                    if annotation.name not in seen_names:
                        seen_names.add(annotation.name)
                        annotations.append(annotation)

        except TimeoutError:
            logger.warning(f"EvalWorkItem {self.debug_identifier} timed out")
            await self._running_experiment.on_timeout(self)

        except anyio.get_cancelled_exc_class():
            # Must re-raise so _run_and_release sees cancellation instead of
            # misclassifying it as a transient/permanent error via the
            # generic Exception handler below.
            logger.debug(f"EvalWorkItem {self.debug_identifier} cancelled")
            raise

        except Exception as e:
            err_type = type(e).__name__
            if self._is_rate_limit_error(e):
                logger.debug(f"EvalWorkItem {self.debug_identifier} hit rate limit ({err_type})")
                await self._running_experiment.on_rate_limit(self)
            elif self._is_transient_error(e):
                logger.warning(
                    f"EvalWorkItem {self.debug_identifier} transient error ({err_type}): {e}"
                )
                await self._running_experiment.on_transient_error(self, e)
            else:
                logger.exception(f"EvalWorkItem {self.debug_identifier} failed ({err_type}): {e}")
                error_end_time = datetime.now(timezone.utc)
                annotator_kind = "LLM" if isinstance(self._evaluator, LLMEvaluator) else "CODE"
                error_annotations: list[models.ExperimentRunAnnotation] = []
                for config in self._output_configs:
                    error_annotations.append(
                        models.ExperimentRunAnnotation(
                            experiment_run_id=self._experiment_run.id,
                            name=config.name,
                            annotator_kind=annotator_kind,
                            label=None,
                            score=None,
                            explanation=None,
                            trace_id=None,
                            error=str(e),
                            metadata_={},
                            start_time=error_end_time,
                            end_time=error_end_time,
                        )
                    )
                error_db_traces = list(tracer.get_db_traces(project_id=self._project_id))
                try:
                    await self._persist_eval_results(error_annotations, error_db_traces)
                except Exception as persist_err:
                    logger.warning(
                        f"EvalWorkItem {self.debug_identifier}: "
                        f"failed to persist error results to DB",
                        exc_info=True,
                    )
                    await self._running_experiment.on_failure(self, persist_err)
                    return

                example_id = GlobalID(
                    DatasetExample.__name__,
                    str(self._dataset_example_revision.dataset_example_id),
                )
                for annotation in error_annotations:
                    self._running_experiment._broadcast(
                        EvaluationChunk(
                            evaluator_name=annotation.name,
                            experiment_run_evaluation=None,
                            dataset_example_id=example_id,
                            repetition_number=self._experiment_run.repetition_number,
                            trace=None,
                            error=annotation.error,
                        )
                    )
                await self._running_experiment.on_failure(self, e)

        else:
            try:
                await self._persist_eval_results(annotations, db_traces)
            except Exception as persist_err:
                logger.warning(
                    f"EvalWorkItem {self.debug_identifier}: failed to persist eval results to DB",
                    exc_info=True,
                )
                await self._running_experiment.on_failure(self, persist_err)
                return

            # Broadcast results to UI
            example_id = GlobalID(
                DatasetExample.__name__,
                str(self._dataset_example_revision.dataset_example_id),
            )
            traces_by_trace_id = {t.trace_id: t for t in db_traces}
            for annotation in annotations:
                eval_db_trace = (
                    traces_by_trace_id.get(annotation.trace_id) if annotation.trace_id else None
                )
                self._running_experiment._broadcast(
                    EvaluationChunk(
                        evaluator_name=annotation.name,
                        experiment_run_evaluation=(
                            ExperimentRunAnnotation(id=annotation.id, db_record=annotation)
                            if not annotation.error
                            else None
                        ),
                        dataset_example_id=example_id,
                        repetition_number=self._experiment_run.repetition_number,
                        trace=(
                            Trace(id=eval_db_trace.id, db_record=eval_db_trace)
                            if eval_db_trace
                            else None
                        ),
                        error=annotation.error,
                    )
                )

            # Check for evaluation error - treat as permanent failure for circuit breaker
            error_result = next((r for r in eval_results if r.get("error") is not None), None)
            if error_result is not None:
                error_exc = error_result.get("error_exc") or Exception(error_result["error"])
                logger.warning(f"EvalWorkItem {self.debug_identifier} returned error: {error_exc}")
                await self._running_experiment.on_failure(self, error_exc)
            else:
                logger.debug(
                    f"EvalWorkItem {self.debug_identifier}: success, "
                    f"wrote {len(annotations)} annotation(s)"
                )
                await self._running_experiment.on_eval_success(self)

    async def _persist_eval_results(
        self,
        annotations: Sequence[models.ExperimentRunAnnotation],
        db_traces: Sequence[models.Trace],
    ) -> None:
        """Persist annotations and traces to DB in parallel.

        Annotation objects are updated in-place with their generated IDs.
        """

        async def _persist_traces() -> None:
            if db_traces:
                async with self._db() as session:
                    session.add_all(db_traces)

        async def _persist_annotations() -> None:
            async with self._db() as session:
                stmt = insert_on_conflict(
                    *[
                        {
                            "experiment_run_id": a.experiment_run_id,
                            "name": a.name,
                            "annotator_kind": a.annotator_kind,
                            "label": a.label,
                            "score": a.score,
                            "explanation": a.explanation,
                            "trace_id": a.trace_id,
                            "error": a.error,
                            "metadata_": a.metadata_,
                            "start_time": a.start_time,
                            "end_time": a.end_time,
                        }
                        for a in annotations
                    ],
                    table=models.ExperimentRunAnnotation,
                    dialect=self._db.dialect,
                    unique_by=["experiment_run_id", "name"],
                    on_conflict=OnConflict.DO_UPDATE,
                    constraint_name="uq_experiment_run_annotations_experiment_run_id_name",
                )
                result = await session.execute(stmt.returning(models.ExperimentRunAnnotation.id))
                for a, (id_,) in zip(annotations, result):
                    a.id = id_

        with anyio.fail_after(5, shield=True):
            async with anyio.create_task_group() as tg:
                tg.start_soon(_persist_traces)
                tg.start_soon(_persist_annotations)

    def _is_rate_limit_error(self, e: Exception) -> bool:
        """Check if exception is a rate limit error using evaluator's client."""

        if isinstance(self._evaluator, LLMEvaluator):
            return self._evaluator.llm_client.is_rate_limit_error(e)
        return False

    def _is_transient_error(self, e: Exception) -> bool:
        """Check if exception is a transient/network error using evaluator's client."""

        if isinstance(e, SQLAlchemyError):
            return True
        if isinstance(self._evaluator, LLMEvaluator):
            return self._evaluator.llm_client.is_transient_error(e)
        return False


# =============================================================================
# Circuit Breaker
# =============================================================================


class CircuitBreaker:
    """
    Simple consecutive-failure circuit breaker.

    Trips after N consecutive failures. One success resets the counter.
    Once tripped, stays tripped (experiment must be restarted).
    """

    def __init__(self, *, threshold: int = 5) -> None:
        self.threshold = threshold
        self._consecutive_failures: int = 0
        self._tripped: bool = False
        self._trip_reason: str | None = None

    def record_failure(self, error: Exception) -> bool:
        """Record a failure. Returns True if circuit just tripped."""
        if self._tripped:
            logger.debug("CircuitBreaker: already tripped, ignoring failure")
            return False
        self._consecutive_failures += 1
        logger.debug(
            f"CircuitBreaker: recorded failure "
            f"{self._consecutive_failures}/{self.threshold}: {error}"
        )
        if self._consecutive_failures >= self.threshold:
            self._tripped = True
            self._trip_reason = _sanitize_error_message(error)
            logger.warning(f"CircuitBreaker: TRIPPED after {self.threshold} consecutive failures")
            return True
        return False

    def record_success(self) -> None:
        """Record a success. Resets failure counter."""
        if self._consecutive_failures > 0:
            logger.debug(
                f"CircuitBreaker: success, resetting counter from {self._consecutive_failures}"
            )
        self._consecutive_failures = 0

    @property
    def is_tripped(self) -> bool:
        return self._tripped

    @property
    def trip_reason(self) -> str | None:
        return self._trip_reason


# =============================================================================
# Retry Item (for heap-based retry queue)
# =============================================================================


@dataclass(order=True)
class RetryItem:
    """Item in the retry queue, ordered by ready_at time."""

    ready_at: datetime
    work_item: WorkItem = field(compare=False)


# =============================================================================
# Running Experiment
# =============================================================================


class OnExperimentDone(Protocol):
    async def __call__(
        self,
        experiment_id: ExperimentId,
        *,
        error_message: str | None = None,
        error_category: str | None = None,
    ) -> None: ...


class RunningExperiment:
    """
    Per-experiment state: queues, rate limit check, creates work items.

    Key behavior:
    - try_get_ready_work_item() checks rate limit and returns a WorkItem or None
    - If None (rate limited or no work), Daemon tries another experiment
    - Rate limit check returns immediately, never blocks waiting for capacity

    Priority: evals > retries > tasks
    """

    _TASK_BATCH_SIZE_MULTIPLIER = 2
    _MIN_TASK_BATCH_SIZE = 10
    _MAX_TASK_BATCH_SIZE = 200
    _WORK_ITEM_HIGH_WATERMARK_MULTIPLIER = 4
    _MIN_WORK_ITEM_HIGH_WATERMARK = 100
    _WORK_ITEM_LOW_WATERMARK_RATIO = 0.5

    def __init__(
        self,
        *,
        experiment: models.Experiment,
        experiment_job: models.ExperimentJob,
        llm_client: LLMClient,
        db: DbSessionFactory,
        decrypt: Callable[[bytes], bytes],
        tracer_factory: Callable[[], Tracer],
        token_buckets: TokenBucketRegistry,
        on_done: OnExperimentDone,
        credentials: Sequence[GenerativeCredentialInput] | None = None,
        evaluator_run_specs: Sequence[EvaluatorRunSpec] = (),
        max_retries: int = 3,
        base_backoff_seconds: float = 1.0,
    ) -> None:
        # Required dependencies
        self._experiment = experiment
        self._experiment_job = experiment_job
        self._llm_client = llm_client
        self._db = db
        self._decrypt = decrypt
        self._tracer_factory = tracer_factory
        self._token_buckets = token_buckets
        self._on_done = on_done

        # Optional configuration
        self._credentials = credentials
        self._evaluator_run_specs = evaluator_run_specs
        self._max_retries = max_retries
        self._base_backoff_seconds = base_backoff_seconds
        self._max_concurrency = experiment_job.max_concurrency

        # Queues (priority: evals > retries > tasks)
        self._task_queue: deque[TaskWorkItem] = deque()
        self._eval_queue: deque[EvalWorkItem] = deque()
        self._retry_heap: list[RetryItem] = []
        self._in_flight: set[WorkItem] = set()
        self._cancel_scopes: dict[WorkItem, anyio.CancelScope] = {}

        # UI subscribers for streaming
        self._subscribers: list[MemoryObjectSendStream[ChatCompletionSubscriptionPayload]] = []

        # Fairness tracking
        self.last_served_at: datetime = datetime.min.replace(tzinfo=timezone.utc)

        # Internal state
        self._active: bool = True
        self._drained: anyio.Event = anyio.Event()

        # Counters for completion summary
        self._tasks_succeeded: int = 0
        self._tasks_failed: int = 0
        self._evals_succeeded: int = 0
        self._evals_failed: int = 0

        # Circuit breakers (separate for tasks and evals since they may use different providers)
        self._task_circuit_breaker = CircuitBreaker()
        self._eval_circuit_breakers: dict[int, CircuitBreaker] = defaultdict(CircuitBreaker)

        # Pagination: load tasks/evals in batches to avoid memory exhaustion
        scaled_batch_size = self._TASK_BATCH_SIZE_MULTIPLIER * max(1, int(self._max_concurrency))
        self._task_batch_size: int = min(
            self._MAX_TASK_BATCH_SIZE,
            max(self._MIN_TASK_BATCH_SIZE, scaled_batch_size),
        )
        self._work_item_high_watermark: int = max(
            self._MIN_WORK_ITEM_HIGH_WATERMARK,
            self._task_batch_size * self._WORK_ITEM_HIGH_WATERMARK_MULTIPLIER,
        )
        self._work_item_low_watermark: int = int(
            self._work_item_high_watermark * self._WORK_ITEM_LOW_WATERMARK_RATIO
        )
        # Keep hysteresis valid even if constants are changed later.
        if self._work_item_low_watermark >= self._work_item_high_watermark:
            self._work_item_low_watermark = max(0, self._work_item_high_watermark - 1)
        self._backpressure_active: bool = False
        self._task_db_offset: int = 0
        self._task_db_exhausted: bool = False

        # Eval buffer: scans for runs with missing evaluations in batches.
        # This is phase 1 (initial reconciliation). Task DB scanning is blocked
        # until this scan reaches exhaustion.
        self._eval_db_exhausted: bool = not bool(evaluator_run_specs)
        self._eval_db_offset: int = 0
        self._initial_eval_scan_done: bool = self._eval_db_exhausted

        # Cached project_id to avoid repeated DB lookups
        self._project_id: int | None = None

    def has_work(self) -> bool:
        """Does this experiment have pending work?"""
        if not self._active:
            logger.debug(f"Experiment {self._experiment.id}: has_work() -> False (inactive)")
            return False

        has_evals = bool(self._eval_queue)
        has_retries = bool(self._retry_heap)
        has_tasks = bool(self._task_queue)
        has_in_flight = bool(self._in_flight)
        has_more_tasks_in_db = not self._task_db_exhausted

        has_more_evals_in_db = not self._eval_db_exhausted

        result = (
            has_evals
            or has_retries
            or has_tasks
            or has_in_flight
            or has_more_tasks_in_db
            or has_more_evals_in_db
        )

        if not result:
            logger.debug(
                f"Experiment {self._experiment.id}: has_work() -> False "
                f"[evals={len(self._eval_queue)}, retries={len(self._retry_heap)}, "
                f"tasks={len(self._task_queue)}, in_flight={len(self._in_flight)}, "
                f"task_db_exhausted={self._task_db_exhausted}, "
                f"eval_db_exhausted={self._eval_db_exhausted}]"
            )
        return result

    def _resident_work_item_count(self) -> int:
        """Total in-memory work-item footprint for this experiment."""
        return (
            len(self._task_queue)
            + len(self._eval_queue)
            + len(self._retry_heap)
            + len(self._in_flight)
        )

    def _update_backpressure_state(self) -> None:
        """Toggle producer backpressure using high/low watermark hysteresis."""
        resident = self._resident_work_item_count()
        if self._backpressure_active:
            if resident <= self._work_item_low_watermark:
                self._backpressure_active = False
                logger.debug(
                    f"Experiment {self._experiment.id}: backpressure OFF "
                    f"(resident={resident}, low={self._work_item_low_watermark})"
                )
            return
        if resident >= self._work_item_high_watermark:
            self._backpressure_active = True
            logger.warning(
                f"Experiment {self._experiment.id}: backpressure ON "
                f"(resident={resident}, high={self._work_item_high_watermark})"
            )

    def _has_ready_retries(self) -> bool:
        """Check if any retries are ready."""
        if not self._retry_heap:
            return False
        return self._retry_heap[0].ready_at <= datetime.now(timezone.utc)

    async def try_get_ready_work_item(self) -> WorkItem | None:
        """
        Return a WorkItem if work is available AND rate limit allows, else None.

        Runs initial eval reconciliation first (phase 1). Once exhausted,
        task buffer refill is enabled (phase 2). Then peeks at next work item,
        checks rate limit, and pops if allowed.
        """
        if not self._initial_eval_scan_done:
            await self._ensure_eval_buffer()
            if self._eval_db_exhausted:
                self._initial_eval_scan_done = True
        if self._initial_eval_scan_done:
            await self._ensure_task_buffer()
        if not self._active:
            logger.debug(
                f"Experiment {self._experiment.id}: try_get_ready_work_item() -> None (inactive)"
            )
            return None

        if len(self._in_flight) >= self._max_concurrency:
            return None

        if not self._has_pending_work():
            # No queued work — check if experiment is fully complete
            # (all DB sources exhausted AND nothing in-flight).
            # This handles the case where resume finds no work at all.
            await self._check_completion()
            return None

        # Peek at next work item without popping
        work_item, pop = self._peek_next_work_item()
        if work_item is None:
            logger.debug(
                f"Experiment {self._experiment.id}: try_get_ready_work_item() -> None "
                f"(peek returned None despite has_pending_work=True)"
            )
            return None

        # Check rate limit using work item's key
        key = work_item.get_rate_limit_key()
        bucket = self._token_buckets[key]
        try:
            bucket.make_request_if_ready()
        except UnavailableTokensError:
            # Rate limited - return None, Daemon tries another experiment
            logger.debug(
                f"Experiment {self._experiment.id}: try_get_ready_work_item() -> None "
                f"(rate limited for key={key}, work_item={work_item.debug_identifier})"
            )
            return None

        # Allowed - pop and return (update fairness so we're served last next time)
        self.last_served_at = datetime.now(timezone.utc)
        pop()
        return work_item

    def _peek_next_work_item(self) -> tuple[WorkItem | None, Callable[[], Any]]:
        """Peek at the next work item in priority order without removing it."""
        # Priority 1: Evals
        if self._eval_queue:
            return self._eval_queue[0], lambda: self._eval_queue.popleft()

        # Priority 2: Ready retries
        if self._has_ready_retries():
            return self._retry_heap[0].work_item, lambda: heapq.heappop(self._retry_heap)

        # Priority 3: Tasks
        if self._task_queue:
            return self._task_queue[0], lambda: self._task_queue.popleft()

        return None, lambda: None

    def register_cancel_scope(self, work_item: WorkItem, scope: anyio.CancelScope) -> None:
        """Register a cancel scope for an in-flight work item.

        Called by Runner when execution starts.
        """
        self._cancel_scopes[work_item] = scope
        self._in_flight.add(work_item)

    async def unregister_cancel_scope(self, work_item: WorkItem) -> None:
        """Unregister a cancel scope when work item completes.

        Called by Runner when execution ends.
        """
        self._cancel_scopes.pop(work_item, None)
        self._in_flight.discard(work_item)
        if not self._active and not self._in_flight:
            self._drained.set()
        await self._check_completion()

    def _has_pending_work(self) -> bool:
        """Check if any work is pending (ignoring rate limits).

        Must mirror has_work() minus the in_flight check. If this returns False
        while DB eval scanning is incomplete, try_get_ready_work_item() calls
        _check_completion() prematurely and the experiment finishes before all
        evaluations are discovered.
        """
        has_evals = bool(self._eval_queue)
        has_ready_retries = self._has_ready_retries()
        has_tasks = bool(self._task_queue)
        has_more_tasks_in_db = not self._task_db_exhausted
        has_more_evals_in_db = not self._eval_db_exhausted
        result = (
            has_evals
            or has_ready_retries
            or has_tasks
            or has_more_tasks_in_db
            or has_more_evals_in_db
        )

        # Log detailed state when we have no pending work (helps debug stalls)
        if not result:
            logger.debug(
                f"Experiment {self._experiment.id}: _has_pending_work() -> False "
                f"[evals={len(self._eval_queue)}, retries={len(self._retry_heap)}, "
                f"tasks={len(self._task_queue)}, task_db_exhausted={self._task_db_exhausted}, "
                f"eval_db_exhausted={self._eval_db_exhausted}, "
                f"in_flight={len(self._in_flight)}]"
            )
        return result

    async def _ensure_task_buffer(self) -> None:
        """Load more tasks from DB if buffer is empty to avoid memory exhaustion."""
        # Early exit if not a prompt task (nothing to dispatch)
        if not isinstance(self._experiment_job, models.ExperimentPromptTask):
            self._task_db_exhausted = True
            return
        self._update_backpressure_state()
        if self._backpressure_active:
            return
        prompt_task = self._experiment_job
        if self._task_queue:
            logger.debug(
                f"Experiment {self._experiment.id}: _ensure_task_buffer() skipped "
                f"(task_queue has {len(self._task_queue)} items)"
            )
            return
        if self._task_db_exhausted:
            logger.debug(
                f"Experiment {self._experiment.id}: _ensure_task_buffer() skipped "
                f"(db_exhausted=True, cursor={self._task_db_offset})"
            )
            return

        logger.debug(
            f"Experiment {self._experiment.id}: _ensure_task_buffer() loading batch "
            f"(cursor={self._task_db_offset}, batch_size={self._task_batch_size})"
        )

        try:
            with anyio.fail_after(5, shield=True):
                async with self._db() as session:
                    # Determine SQL dialect
                    assert session.bind is not None
                    dialect = SupportedSQLDialect(session.bind.dialect.name)

                    # Get project_id from cache or DB
                    if self._project_id is None:
                        self._project_id = await session.scalar(
                            select(models.Project.id).where(
                                models.Project.name == self._experiment.project_name
                            )
                        )
                        if self._project_id is None:
                            logger.error(
                                f"Project '{self._experiment.project_name}' "
                                "not found for experiment "
                                f"{self._experiment.id}"
                            )
                            self._task_db_exhausted = True
                            return
                    project_id = self._project_id

                    # Query incomplete runs with pagination
                    stmt = get_experiment_incomplete_runs_query(
                        self._experiment,
                        dialect,
                        cursor_example_rowid=self._task_db_offset
                        if self._task_db_offset > 0
                        else None,
                        limit=self._task_batch_size,
                    )
                    result = await session.execute(stmt)
                    rows = result.all()
        except (SQLAlchemyError, TimeoutError) as e:
            # DB error - log and return without marking exhausted so we retry next cycle
            logger.warning(
                f"Experiment {self._experiment.id}: _ensure_task_buffer() DB error, "
                f"will retry next cycle: {e}"
            )
            return

        # Check if we've exhausted all tasks
        has_more = len(rows) > self._task_batch_size
        logger.debug(
            f"Experiment {self._experiment.id}: _ensure_task_buffer() query returned "
            f"{len(rows)} rows (batch_size={self._task_batch_size}, has_more={has_more})"
        )
        if has_more:
            # Cursor points to first item of NEXT page (the extra row we fetched)
            next_page_first_item = rows[self._task_batch_size][0]
            next_cursor = next_page_first_item.dataset_example_id
            rows = rows[: self._task_batch_size]
        else:
            next_cursor = None
            logger.info(
                f"Experiment {self._experiment.id}: setting _task_db_exhausted=True "
                f"(rows={len(rows)}, cursor={self._task_db_offset})"
            )
            self._task_db_exhausted = True

        if not rows:
            logger.debug(f"Experiment {self._experiment.id}: no rows returned, returning early")
            # Check completion: experiment may be done if DB exhausted and no tasks in queue
            await self._check_completion()
            return

        # Update cursor for next batch
        if next_cursor is not None:
            old_cursor = self._task_db_offset
            self._task_db_offset = next_cursor
            logger.debug(
                f"Experiment {self._experiment.id}: cursor advanced {old_cursor} -> "
                f"{self._task_db_offset}"
            )

        # Process each incomplete run
        for revision, successful_count, incomplete_reps in rows:
            # Parse incomplete repetitions
            # (SQLite returns JSON string, PostgreSQL returns array)
            if successful_count == 0:
                # Completely missing - need all repetitions
                incomplete = list(range(1, self._experiment.repetitions + 1))
            elif dialect is SupportedSQLDialect.POSTGRESQL:
                incomplete = [r for r in incomplete_reps if r is not None]
            else:
                incomplete = [r for r in json.loads(incomplete_reps) if r is not None]

            # Create a TaskWorkItem for each incomplete repetition
            for repetition_number in incomplete:
                work_item = self._create_task_work_item(
                    dataset_example_revision=revision,
                    repetition_number=repetition_number,
                    prompt_task=prompt_task,
                    project_id=project_id,
                )
                self._task_queue.append(work_item)

        logger.debug(f"Loaded {len(self._task_queue)} tasks for experiment {self._experiment.id}")

    async def _ensure_eval_buffer(self) -> None:
        """Load eval work items for runs with missing evaluations, in batches.

        This scan is phase-1 initial reconciliation. It runs before task DB
        scan is enabled and paginates to exhaustion.

        Catches:
        - Evals lost to a crash during a previous run
        - Newly attached evaluators on a resumed experiment
        - For new experiments: no-op (no completed runs exist yet)
        """
        if self._eval_db_exhausted:
            return
        self._update_backpressure_state()
        if self._backpressure_active:
            return

        # Build per-evaluator output-name sets.
        # Queueing is per evaluator spec (not per output name) so multi-output evaluators
        # are executed once even when multiple outputs are missing.
        spec_output_names: list[tuple[EvaluatorRunSpec, set[str]]] = []
        for spec in self._evaluator_run_specs:
            output_names = {oc.name for oc in spec.output_configs if oc.name}
            if output_names:
                spec_output_names.append((spec, output_names))
        eval_names = sorted(
            {name for _, output_names in spec_output_names for name in output_names}
        )
        if not eval_names:
            self._eval_db_exhausted = True
            return

        try:
            with anyio.fail_after(5, shield=True):
                async with self._db() as session:
                    assert session.bind is not None
                    dialect = SupportedSQLDialect(session.bind.dialect.name)
                    stmt = get_runs_with_incomplete_evaluations_query(
                        self._experiment.id,
                        eval_names,
                        dialect,
                        cursor_run_rowid=self._eval_db_offset or None,
                        limit=self._task_batch_size,
                        include_annotations_and_revisions=True,
                    )
                    result = await session.execute(stmt)
                    rows = result.all()
        except (SQLAlchemyError, TimeoutError) as e:
            logger.warning(
                f"Experiment {self._experiment.id}: _ensure_eval_buffer() DB error, "
                f"will retry next cycle: {e}"
            )
            return

        has_more = len(rows) > self._task_batch_size
        if has_more:
            next_cursor: int | None = rows[self._task_batch_size][0].id
            rows = rows[: self._task_batch_size]
        else:
            next_cursor = None

        if not rows:
            self._eval_db_exhausted = True
            logger.debug(
                f"Experiment {self._experiment.id}: _ensure_eval_buffer() no incomplete evals found"
            )
            return

        # Update cursor for next batch
        if next_cursor is not None:
            self._eval_db_offset = next_cursor
        else:
            self._eval_db_exhausted = True

        queued = 0
        for row in rows:
            run = row[0]
            revision = row[2]
            annotations_json = row[3]
            successful_names: set[str] = (
                set(json.loads(annotations_json)) if annotations_json else set()
            )

            for spec, output_names in spec_output_names:
                if output_names.issubset(successful_names):
                    continue
                self._eval_queue.append(
                    self._create_eval_work_item(
                        experiment_run=run,
                        dataset_example_revision=revision,
                        dataset_evaluator_id=spec.dataset_evaluator_id,
                        evaluator=spec.evaluator,
                        input_mapping=spec.input_mapping,
                        output_configs=spec.output_configs,
                        project_id=spec.evaluator_project_id,
                    )
                )
                queued += 1

        logger.info(
            f"Experiment {self._experiment.id}: _ensure_eval_buffer() "
            f"queued {queued} eval work item(s) from {len(rows)} run(s)"
        )

    def _create_task_work_item(
        self,
        dataset_example_revision: models.DatasetExampleRevision,
        repetition_number: int,
        prompt_task: models.ExperimentPromptTask,
        project_id: int,
    ) -> TaskWorkItem:
        """Create a TaskWorkItem owned by this experiment."""
        return TaskWorkItem(
            running_experiment=self,
            experiment=self._experiment,
            dataset_example_revision=dataset_example_revision,
            repetition_number=repetition_number,
            prompt_task=prompt_task,
            llm_client=self._llm_client,
            db=self._db,
            decrypt=self._decrypt,
            tracer_factory=self._tracer_factory,
            project_id=project_id,
            credentials=self._credentials,
        )

    def _create_eval_work_item(
        self,
        experiment_run: models.ExperimentRun,
        dataset_example_revision: models.DatasetExampleRevision,
        dataset_evaluator_id: int,
        evaluator: BaseEvaluator,
        input_mapping: InputMapping,
        output_configs: Sequence[OutputConfigType],
        project_id: int,
    ) -> EvalWorkItem:
        """Create an EvalWorkItem owned by this experiment."""
        return EvalWorkItem(
            running_experiment=self,
            experiment_run=experiment_run,
            dataset_example_revision=dataset_example_revision,
            dataset_evaluator_id=dataset_evaluator_id,
            evaluator=evaluator,
            input_mapping=input_mapping,
            output_configs=output_configs,
            db=self._db,
            tracer_factory=self._tracer_factory,
            project_id=project_id,
        )

    # === Task Event Handlers ===

    def _broadcast(self, payload: ChatCompletionSubscriptionPayload) -> None:
        """Send a payload to all UI subscribers, cleaning up closed streams."""
        if not self._subscribers:
            return
        closed: list[MemoryObjectSendStream[ChatCompletionSubscriptionPayload]] = []
        for stream in self._subscribers:
            try:
                stream.send_nowait(payload)
            except anyio.WouldBlock:
                pass
            except (anyio.ClosedResourceError, anyio.BrokenResourceError):
                closed.append(stream)
        for stream in closed:
            self._subscribers.remove(stream)

    async def on_task_success(
        self,
        work_item: TaskWorkItem,
        experiment_run: models.ExperimentRun,
    ) -> None:
        """Task completed. Queue eval work items for each evaluator (feedback loop)."""
        self._tasks_succeeded += 1
        self._task_circuit_breaker.record_success()

        if not self._active:
            return

        # Feedback loop: queue eval work items for this task's result
        for spec in self._evaluator_run_specs:
            self._eval_queue.append(
                self._create_eval_work_item(
                    experiment_run=experiment_run,
                    dataset_example_revision=work_item.dataset_example_revision,
                    dataset_evaluator_id=spec.dataset_evaluator_id,
                    evaluator=spec.evaluator,
                    input_mapping=spec.input_mapping,
                    output_configs=spec.output_configs,
                    project_id=spec.evaluator_project_id,
                )
            )

    async def on_eval_success(self, work_item: EvalWorkItem) -> None:
        """Eval completed. Pure bookkeeping: counters and circuit breaker reset."""
        self._evals_succeeded += 1
        self._eval_circuit_breakers[work_item.dataset_evaluator_id].record_success()

    # === Unified Error Handlers ===

    def _make_log(
        self,
        work_item: WorkItem,
        *,
        message: str,
        level: str = "ERROR",
        detail: FailureDetail | RetriesExhaustedDetail | None = None,
    ) -> models.ExperimentLog:
        """Create the correct polymorphic log subtype for a work item."""
        if isinstance(work_item, TaskWorkItem):
            return models.ExperimentTaskLog(
                experiment_id=self._experiment.id,
                level=level,
                message=message,
                detail=detail,
                dataset_example_id=work_item.dataset_example_revision.dataset_example_id,
                repetition_number=work_item.repetition_number,
            )
        assert isinstance(work_item, EvalWorkItem)
        return models.ExperimentEvalLog(
            experiment_id=self._experiment.id,
            level=level,
            message=message,
            detail=detail,
            experiment_run_id=work_item.experiment_run.id,
            dataset_evaluator_id=work_item.dataset_evaluator_id,
        )

    def _get_circuit_breaker(self, work_item: WorkItem) -> CircuitBreaker:
        if isinstance(work_item, TaskWorkItem):
            return self._task_circuit_breaker
        assert isinstance(work_item, EvalWorkItem)
        return self._eval_circuit_breakers[work_item.dataset_evaluator_id]

    def _record_failure(self, work_item: WorkItem) -> None:
        if isinstance(work_item, TaskWorkItem):
            self._tasks_failed += 1
        else:
            self._evals_failed += 1

    async def on_rate_limit(self, work_item: WorkItem) -> None:
        """Work item hit rate limit. Update token bucket and requeue with backoff."""
        key = work_item.get_rate_limit_key()
        bucket = self._token_buckets[key]
        bucket.on_rate_limit_error(
            request_start_time=datetime.now(timezone.utc).timestamp(), verbose=False
        )
        await self._retry_or_fail(work_item, "rate limit")

    async def on_transient_error(self, work_item: WorkItem, error: Exception) -> None:
        """Work item hit transient/network error. Check circuit breaker, then retry."""
        breaker = self._get_circuit_breaker(work_item)
        if breaker.record_failure(error):
            await self._handle_circuit_trip(
                "task" if isinstance(work_item, TaskWorkItem) else "eval",
                breaker.trip_reason or _sanitize_error_message(error),
            )
            return
        await self._retry_or_fail(
            work_item, f"transient error: {_sanitize_error_message(error)}", error=error
        )

    async def on_failure(
        self,
        work_item: WorkItem,
        error: Exception,
    ) -> None:
        """Work item failed with non-retryable error. Record and check circuit breaker.

        Broadcasting is the caller's responsibility — this method only handles
        bookkeeping: failure counters, logging, and circuit breakers.
        """
        self._record_failure(work_item)
        category = "TASK" if isinstance(work_item, TaskWorkItem) else "EVAL"
        logger.warning(f"{work_item.debug_identifier} {error}")
        await self._persist_log(
            self._make_log(
                work_item,
                message=_sanitize_error_message(error),
                detail=FailureDetail(
                    type="failure",
                    error_type=type(error).__name__,
                ),
            )
        )
        breaker = self._get_circuit_breaker(work_item)
        if breaker.record_failure(error):
            await self._handle_circuit_trip(
                category.lower(),
                breaker.trip_reason or _sanitize_error_message(error),
            )

    async def on_timeout(self, work_item: WorkItem) -> None:
        """Work item timed out. Treat as retryable."""
        await self._retry_or_fail(work_item, "timeout")

    async def _retry_or_fail(
        self, work_item: WorkItem, reason: str, error: Exception | None = None
    ) -> None:
        """Requeue with exponential backoff, or record failure if retries exhausted."""
        if work_item.retry_count < self._max_retries:
            work_item.retry_count += 1
            backoff = self._base_backoff_seconds * (2 ** (work_item.retry_count - 1))
            ready_at = datetime.now(timezone.utc) + timedelta(seconds=backoff)
            logger.debug(
                f"{work_item.debug_identifier} {reason}, retry "
                f"{work_item.retry_count}/{self._max_retries} in {backoff:.1f}s"
            )
            heapq.heappush(self._retry_heap, RetryItem(ready_at=ready_at, work_item=work_item))
            return
        error_msg = f"{reason} after {self._max_retries} retries"
        logger.warning(
            f"{work_item.debug_identifier} exceeded max retries "
            f"({self._max_retries}), reason: {reason}"
        )
        await self._persist_log(
            self._make_log(
                work_item,
                message=error_msg,
                detail=RetriesExhaustedDetail(
                    type="retries_exhausted",
                    retry_count=self._max_retries,
                    reason=reason,
                ),
            )
        )
        # Persist error DB record so the terminal outcome is visible in experiment results
        await self._persist_exhausted_retry(work_item, error_msg)
        # Notify UI subscribers
        if isinstance(work_item, TaskWorkItem):
            self._broadcast(
                ChatCompletionSubscriptionError(
                    message=error_msg,
                    dataset_example_id=GlobalID(
                        DatasetExample.__name__,
                        str(work_item.dataset_example_revision.dataset_example_id),
                    ),
                    repetition_number=work_item.repetition_number,
                )
            )
        elif isinstance(work_item, EvalWorkItem):
            dataset_example_id = GlobalID(
                DatasetExample.__name__,
                str(work_item.dataset_example_revision.dataset_example_id),
            )
            for config in work_item._output_configs:
                self._broadcast(
                    EvaluationChunk(
                        evaluator_name=config.name,
                        experiment_run_evaluation=None,
                        dataset_example_id=dataset_example_id,
                        repetition_number=work_item.experiment_run.repetition_number,
                        trace=None,
                        error=error_msg,
                    )
                )
        self._record_failure(work_item)
        breaker = self._get_circuit_breaker(work_item)
        if breaker.record_failure(error or RuntimeError(error_msg)):
            await self._handle_circuit_trip(
                "task" if isinstance(work_item, TaskWorkItem) else "eval",
                breaker.trip_reason or error_msg,
            )

    async def _persist_exhausted_retry(self, work_item: WorkItem, error_msg: str) -> None:
        """Persist an error DB record for a work item whose retries are exhausted.

        For tasks: upserts an ExperimentRun with error.
        For evals: upserts error annotations via _persist_eval_results.
        """
        now = datetime.now(timezone.utc)
        try:
            if isinstance(work_item, TaskWorkItem):
                db_run = models.ExperimentRun(
                    experiment_id=self._experiment.id,
                    dataset_example_id=work_item.dataset_example_revision.dataset_example_id,
                    trace_id=None,
                    output={},
                    repetition_number=work_item.repetition_number,
                    start_time=now,
                    end_time=now,
                    error=error_msg,
                    trace=None,
                )
                await work_item._persist_run(db_run)
            elif isinstance(work_item, EvalWorkItem):
                annotator_kind = "LLM" if isinstance(work_item._evaluator, LLMEvaluator) else "CODE"
                error_annotations = [
                    models.ExperimentRunAnnotation(
                        experiment_run_id=work_item.experiment_run.id,
                        name=config.name,
                        annotator_kind=annotator_kind,
                        label=None,
                        score=None,
                        explanation=None,
                        trace_id=None,
                        error=error_msg,
                        metadata_={},
                        start_time=now,
                        end_time=now,
                    )
                    for config in work_item._output_configs
                ]
                await work_item._persist_eval_results(error_annotations, [])
        except Exception:
            logger.warning(
                f"{work_item.debug_identifier}: failed to persist exhausted-retry error to DB",
                exc_info=True,
            )

    async def _persist_log(self, log: models.ExperimentLog) -> None:
        """Persist a log row for this experiment."""
        try:
            async with self._db() as session:
                session.add(log)
        except Exception:
            logger.exception(
                f"Experiment {self._experiment.id}: failed to persist log: {log.message}"
            )

    # === Circuit Breaker & Completion ===

    async def _handle_circuit_trip(self, job_type: str, reason: str) -> None:
        """
        Handle circuit breaker trip - stop experiment and notify subscribers.

        Args:
            job_type: "task" or "eval" - which circuit breaker tripped
            reason: The error message that caused the trip
        """
        logger.warning(
            f"Experiment {self._experiment.id}: circuit breaker tripped ({job_type}): {reason}"
        )

        # Send error to all subscribers before cancelling
        error_payload = ChatCompletionSubscriptionError(
            message=f"Experiment stopped: {reason} (5 consecutive failures)",
            dataset_example_id=None,  # Experiment-level error, not task-specific
            repetition_number=None,
        )

        for send_stream in self._subscribers:
            try:
                send_stream.send_nowait(error_payload)
                logger.debug(
                    f"Experiment {self._experiment.id}: sent circuit trip error to subscriber"
                )
            except anyio.WouldBlock:
                logger.warning(
                    f"Experiment {self._experiment.id}: subscriber buffer full, dropping error"
                )
            except (anyio.ClosedResourceError, anyio.BrokenResourceError):
                logger.debug(f"Experiment {self._experiment.id}: subscriber already disconnected")

        # Close all subscriber streams so they receive EndOfStream
        logger.debug(
            f"Experiment {self._experiment.id}: "
            f"closing {len(self._subscribers)} subscriber stream(s)"
        )
        for send_stream in self._subscribers:
            try:
                await send_stream.aclose()
                logger.debug(f"Experiment {self._experiment.id}: closed subscriber stream")
            except Exception as e:
                logger.debug(f"Experiment {self._experiment.id}: error closing stream: {e}")
        self._subscribers.clear()
        logger.debug(f"Experiment {self._experiment.id}: all subscriber streams closed")

        # Stop the experiment (stops in-flight jobs, clears queues)
        self.stop()

        # Notify daemon to remove us and update DB status (with error)
        error_message = f"Circuit breaker tripped ({job_type}): {reason}"
        await self._on_done(
            self._experiment.id,
            error_message=error_message,
            error_category="EXPERIMENT",
        )

    async def _check_completion(self) -> None:
        """Check if experiment is complete (no pending work, nothing in-flight)."""
        if not self._active:
            logger.debug(f"Experiment {self._experiment.id}: _check_completion() skip (inactive)")
            return

        if not self.has_work():
            self._active = False
            # Close subscriber streams so consumers get EndOfStream.
            # Prefer aclose() over sync close() since this method is async.
            for stream in self._subscribers:
                await stream.aclose()
            self._subscribers.clear()
            logger.info(
                f"Experiment {self._experiment.id} completed: "
                f"tasks={self._tasks_succeeded} succeeded, {self._tasks_failed} failed; "
                f"evals={self._evals_succeeded} succeeded, {self._evals_failed} failed"
            )
            await self._on_done(self._experiment.id)

    def stop(self) -> None:
        """
        Stop this experiment.

        NOTE: Does NOT call on_done. The caller (stop mutation, heartbeat, etc.)
        is responsible for handling status updates. on_done is only for natural
        completion via _check_completion().
        """
        # Idempotency guard: if already stopped, no-op
        if not self._active:
            return

        self._active = False
        pending_tasks = len(self._task_queue)
        pending_evals = len(self._eval_queue)
        pending_retries = len(self._retry_heap)
        in_flight = len(self._in_flight)

        # Cancel all in-flight work items via their scopes
        cancelled_count = 0
        for scope in self._cancel_scopes.values():
            scope.cancel()
            cancelled_count += 1

        # Clear all queues to release memory and prevent any further processing
        # (Queued work is transient - derived from DB state, reconstructed on resume)
        self._task_queue.clear()
        self._eval_queue.clear()
        self._retry_heap.clear()

        # Close all subscriber streams so they receive EndOfStream.
        # Uses sync close() because stop() is a sync method (called from
        # heartbeat lost-ownership path). MemoryObjectSendStream.close()
        # is equivalent to aclose() for in-memory streams.
        subscriber_count = len(self._subscribers)
        for stream in self._subscribers:
            stream.close()
        self._subscribers.clear()

        # If nothing is in-flight, mark drained immediately so callers don't wait forever
        if not self._in_flight:
            self._drained.set()

        logger.info(
            f"Experiment {self._experiment.id} stopped: "
            f"tasks={self._tasks_succeeded} succeeded, {self._tasks_failed} failed; "
            f"evals={self._evals_succeeded} succeeded, {self._evals_failed} failed; "
            f"dropped: {pending_tasks} tasks, {pending_evals} evals, {pending_retries} retries, "
            f"{in_flight} in-flight ({cancelled_count} cancelled), "
            f"{subscriber_count} subscribers closed"
        )
        # NOTE: on_done is NOT called here. See docstring.

    # === Subscription ===

    def subscribe(
        self,
    ) -> MemoryObjectReceiveStream[ChatCompletionSubscriptionPayload]:
        """Subscribe to experiment progress updates.

        Returns a receive stream. Close it when done; cleanup happens automatically.
        """
        send_stream, receive_stream = anyio.create_memory_object_stream[
            ChatCompletionSubscriptionPayload
        ](max_buffer_size=1000)
        self._subscribers.append(send_stream)
        logger.debug(
            f"Experiment {self._experiment.id}: new subscriber, total={len(self._subscribers)}"
        )
        return receive_stream


# =============================================================================
# Daemon (Singleton Orchestrator)
# =============================================================================


class ExperimentRunner(DaemonTask):
    """
    Singleton daemon that orchestrates background experiment execution.

    Key patterns:
    - Semaphore-first dispatch: acquire slot before looking for work
    - Round-robin fairness: least-recently-served experiment gets priority
    - Non-blocking rate limits: experiments return None if rate limited
    - Auto-resume: orphaned experiments resumed on startup
    """

    MAX_CONCURRENT = 1000
    POLL_INTERVAL = 0.1  # seconds
    MAX_CONSECUTIVE_ERRORS = 50  # Stop daemon after this many consecutive internal errors

    # Timeout for detecting stale claims from crashed replicas
    STALE_CLAIM_TIMEOUT = EXPERIMENT_STALE_CLAIM_TIMEOUT
    HEARTBEAT_INTERVAL = EXPERIMENT_STALE_CLAIM_TIMEOUT / 2
    HEARTBEAT_JITTER = timedelta(seconds=EXPERIMENT_STALE_CLAIM_TIMEOUT.seconds * 0.1)

    # Orphan scan: check for crashed replicas' experiments periodically
    # Base interval + random jitter to avoid thundering herd across replicas
    ORPHAN_SCAN_INTERVAL = EXPERIMENT_STALE_CLAIM_TIMEOUT
    ORPHAN_SCAN_JITTER = timedelta(seconds=EXPERIMENT_STALE_CLAIM_TIMEOUT.seconds * 0.1)

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        decrypt: Callable[[bytes], bytes],
        tracer_factory: Callable[[], Tracer],
    ) -> None:
        super().__init__()
        self._db = db
        self._decrypt = decrypt
        self._tracer_factory = tracer_factory
        self._experiments: dict[ExperimentId, RunningExperiment] = {}
        self._seats = Semaphore(self.MAX_CONCURRENT)
        self._work_available = anyio.Event()
        # Unique replica ID for coordinating experiment ownership across replicas
        self._replica_id = token_hex(8)
        # Rate limit buckets keyed by client's rate_limit_key.
        self._token_buckets: TokenBucketRegistry = AutoCreateTokenBucketRegistry(maxsize=100)
        # Cancel scope for forceful shutdown - set during _run()
        self._task_group_cancel_scope: anyio.CancelScope | None = None

    async def _run(self) -> None:
        """
        Main dispatch loop (semaphore-first pattern).

        1. Wait for experiments if none exist
        2. Acquire semaphore slot (wait if all busy)
        3. Round-robin through experiments for ready work item
        4. If work item found, dispatch; else release slot and sleep
        """
        logger.debug(f"ExperimentRunner daemon starting (replica_id={self._replica_id})")

        async with anyio.create_task_group() as tg:
            # Save cancel scope so graceful_shutdown can force-cancel if needed
            self._task_group_cancel_scope = tg.cancel_scope
            # Start background loops
            tg.start_soon(self._heartbeat_loop)
            tg.start_soon(self._orphan_scan_loop)
            # Track consecutive errors to detect programming bugs (e.g., AttributeError in a loop).
            # Without this, internal errors would spin infinitely. After MAX_CONSECUTIVE_ERRORS,
            # we stop the daemon rather than burn CPU and fill logs.
            consecutive_errors = 0
            try:
                while self._running:
                    acquired = False
                    try:
                        # Wait for experiments if none exist
                        if not self._experiments:
                            logger.debug("No experiments, waiting for work...")
                            await self._wait_for_work_available()
                            logger.debug("Work available, resuming dispatch loop")
                            continue

                        # Semaphore-first: acquire slot before looking for work
                        await self._seats.acquire()
                        acquired = True
                        logger.debug(
                            "Dispatch loop: semaphore acquired, "
                            f"active_experiments={len(self._experiments)}"
                        )

                        # Round-robin through experiments for fairness
                        work_item = await self._try_get_ready_work_item()

                        if work_item:
                            logger.debug(f"Dispatching work item: {work_item.debug_identifier}")
                            tg.start_soon(self._run_and_release, work_item)
                            acquired = False  # Ownership transferred to work item
                        else:
                            self._seats.release()
                            acquired = False
                            logger.debug(
                                "Dispatch loop: no ready work item, sleeping %.2fs",
                                self.POLL_INTERVAL,
                            )
                            await anyio.sleep(self.POLL_INTERVAL)

                        consecutive_errors = 0
                    except anyio.get_cancelled_exc_class():
                        raise
                    except Exception:
                        consecutive_errors += 1
                        if acquired:
                            try:
                                self._seats.release()
                            except ValueError:
                                pass

                        logger.exception(
                            f"Dispatch loop error "
                            f"({consecutive_errors}/{self.MAX_CONSECUTIVE_ERRORS})"
                        )

                        if consecutive_errors >= self.MAX_CONSECUTIVE_ERRORS:
                            logger.critical(
                                f"Dispatch loop hit {self.MAX_CONSECUTIVE_ERRORS} "
                                "consecutive errors, stopping daemon. "
                                "This is likely a programming bug."
                            )
                            self._running = False
                            break

                        # Exponential backoff: 0.1s, 0.2s, 0.4s, ... capped at 30s
                        backoff = min(0.1 * (2**consecutive_errors), 30.0)
                        await anyio.sleep(backoff)
            except anyio.get_cancelled_exc_class():
                logger.debug("Dispatch loop cancelled")
                raise
            finally:
                # On shutdown, wait for in-flight work items to complete
                logger.debug(
                    f"Dispatch loop ending (_running={self._running}), starting graceful shutdown"
                )
                await self._graceful_shutdown()

    async def _wait_for_work_available(self) -> None:
        """Wait for work signal without dropping a concurrent wake-up."""
        wait_event = self._work_available
        await wait_event.wait()
        # Reset the event only after consuming this wake-up to avoid
        # missing a signal that arrives right before wait().
        if wait_event is self._work_available:
            self._work_available = anyio.Event()

    async def _try_get_ready_work_item(self) -> WorkItem | None:
        """
        Try to get a ready work item from any experiment (round-robin for fairness).

        Sorts experiments by last_served_at so least-recently-served gets priority.
        Each experiment's try_get_ready_work_item() checks rate limit non-blocking.
        """
        # Sort by fairness: least recently served first
        candidates = sorted(
            self._experiments.values(),
            key=lambda e: e.last_served_at,
        )

        if not candidates:
            logger.debug("_try_get_ready_work_item: no experiments in registry")
            return None

        for candidate in candidates:
            if work_item := await candidate.try_get_ready_work_item():
                return work_item

        # Log why we couldn't find work (helps debug stalled experiments)
        states = [
            (
                e._experiment.id,
                e._active,
                len(e._task_queue),
                len(e._eval_queue),
                len(e._in_flight),
                len(e._retry_heap),
                e._task_db_exhausted,
            )
            for e in candidates
        ]
        logger.debug(
            f"_try_get_ready_work_item: checked {len(candidates)} experiments, "
            f"none had ready work. States (id, active, tasks, evals, "
            f"in_flight, retries, db_exhausted): {states}"
        )
        return None

    async def _run_and_release(self, work_item: WorkItem) -> None:
        """Execute work item and release semaphore."""
        try:
            # Create cancel scope so experiment can cancel this work item
            with anyio.CancelScope() as scope:
                work_item.running_experiment.register_cancel_scope(work_item, scope)
                await work_item.execute()
        except anyio.get_cancelled_exc_class():
            logger.debug(f"Work item {work_item.debug_identifier} was cancelled")
        except Exception:
            logger.exception(f"Work item {work_item.debug_identifier} raised unhandled exception")
        finally:
            try:
                await work_item.running_experiment.unregister_cancel_scope(work_item)
            except Exception:
                logger.exception(
                    f"Work item {work_item.debug_identifier} failed to unregister cancel scope"
                )
            finally:
                logger.debug(
                    f"Work item {work_item.debug_identifier} finished, releasing semaphore"
                )
                self._seats.release()

    async def _graceful_shutdown(self, timeout: float = 5.0) -> None:
        """
        Gracefully shut down all experiments.

        This does in-memory cleanup only (no DB update) so experiments can resume
        on restart. Ownership is preserved in the DB via claimed_by/claimed_at.

        Steps:
        1. Stop all experiments (cancels jobs, clears queues, closes subscribers)
        2. Wait for shielded DB writes to complete (bounded by timeout)
        3. Force-cancel if timeout exceeded
        """
        experiment_count = len(self._experiments)
        in_flight_count = sum(len(exp._in_flight) for exp in self._experiments.values())

        if experiment_count == 0:
            logger.debug("Graceful shutdown: no experiments running")
            return

        logger.info(
            f"Graceful shutdown: stopping {experiment_count} experiments "
            f"with {in_flight_count} in-flight work items"
        )

        # Stop all experiments (in-memory only - preserves DB ownership for resume)
        for exp_id, exp in list(self._experiments.items()):
            logger.debug(f"Graceful shutdown: stopping experiment {exp_id}")
            exp.stop()
        # Don't clear _experiments here - let shielded operations reference them

        if in_flight_count == 0:
            logger.debug("Graceful shutdown: no in-flight work items to wait for")
            self._experiments.clear()
            return

        logger.debug(f"Graceful shutdown: waiting up to {timeout}s for shielded DB writes")

        # Wait for semaphore to be fully released (all shielded operations complete).
        # Acquiring all MAX_CONCURRENT slots proves every in-flight work item has released
        # its slot (including shielded DB writes). Free slots are acquired instantly;
        # only held slots block. The slots are NOT released after drain — this is
        # intentional since the daemon is shutting down and _run() will not loop again.
        try:
            with anyio.fail_after(timeout):
                for _ in range(self.MAX_CONCURRENT):
                    await self._seats.acquire()
            logger.debug("Graceful shutdown: all shielded operations completed")
        except TimeoutError:
            logger.warning(f"Graceful shutdown: timed out after {timeout}s, force-cancelling")
            # Force-cancel the task group to kill httpx connections
            if self._task_group_cancel_scope:
                self._task_group_cancel_scope.cancel()

        # Clear registry after shutdown
        self._experiments.clear()

    async def _resume_orphaned(self) -> None:
        """
        Resume orphaned experiments on startup.

        Finds experiments that were running but their owner crashed:
        - claimed_at is NOT NULL (was running) AND claimed_at is stale

        This handles:
        - Server crash during experiment execution
        - Network partition where replica became unreachable

        Note: this only *discovers* orphan IDs. The actual atomic claim
        happens inside start_experiment(), which uses a conditional UPDATE
        that also accepts stale claims (``claimed_at < cutoff``).  This
        avoids a double-claim pattern where _resume_orphaned claims first
        and start_experiment redundantly claims again — which also had the
        side-effect of deleting prior-run errors before they could be
        inspected.
        """
        cutoff = datetime.now(timezone.utc) - self.STALE_CLAIM_TIMEOUT

        async with self._db() as session:
            # Find orphaned experiments (claimed but stale)
            stmt = (
                select(models.ExperimentJob.id)
                .where(models.ExperimentJob.claimed_at.is_not(None))
                .where(models.ExperimentJob.claimed_at < cutoff)
            )
            result = await session.execute(stmt)
            orphan_ids = [row[0] for row in result]

        if not orphan_ids:
            logger.debug("No orphaned experiments found")
            return

        logger.info(f"Found {len(orphan_ids)} orphaned experiments, resuming...")

        for config_id in orphan_ids:
            try:
                await self.start_experiment(config_id, subscribe=False)
                logger.info(f"Resumed orphaned experiment {config_id}")
            except Exception:
                logger.exception(f"Failed to start orphaned experiment {config_id}")

    # === Internal helpers for start_experiment ===

    async def _claim_experiment(
        self,
        session: AsyncSession,
        experiment_id: int,
    ) -> models.Experiment:
        """Atomically claim ownership of an experiment and clear prior errors.

        Succeeds when the experiment is:
          1. Unclaimed (new experiment)
          2. Already ours (idempotent retry)
          3. Stale claim from a crashed replica (orphan recovery)

        Returns the loaded Experiment row.
        Raises ValueError if the experiment is owned by another active replica or missing.
        """
        now = datetime.now(timezone.utc)
        stale_cutoff = now - self.STALE_CLAIM_TIMEOUT
        stmt = (
            update(models.ExperimentJob)
            .where(models.ExperimentJob.id == experiment_id)
            .where(
                or_(
                    models.ExperimentJob.claimed_by.is_(None),
                    models.ExperimentJob.claimed_by == self._replica_id,
                    models.ExperimentJob.claimed_at < stale_cutoff,
                )
            )
            .values(
                claimed_at=now,
                claimed_by=self._replica_id,
                status="RUNNING",
            )
            .returning(models.ExperimentJob.id)
        )
        claimed = await session.scalar(stmt)
        if claimed is None:
            raise ValueError(
                f"Experiment {experiment_id} is owned by another replica, cannot start"
            )
        await session.execute(
            delete(models.ExperimentLog).where(models.ExperimentLog.experiment_id == experiment_id)
        )
        experiment = await session.get(models.Experiment, experiment_id)
        if experiment is None:
            raise ValueError(f"Experiment {experiment_id} no longer exists")
        return experiment

    async def _load_experiment_config(
        self,
        session: AsyncSession,
        experiment_id: int,
        credentials: Sequence[GenerativeCredentialInput] | None,
    ) -> tuple[models.ExperimentJob, LLMClient, list[EvaluatorRunSpec]]:
        """Load execution config, resolve LLM client, and build evaluator specs.

        Returns (experiment_job, llm_client, evaluator_run_specs).
        """
        # Load child class directly to eagerly populate all columns.
        # Using session.get() on the base ExperimentJob with joined-table
        # inheritance lazily loads child-class columns, which triggers a greenlet_spawn
        # error when accessed outside the session's internal greenlet.
        llm_client: LLMClient
        prompt_task = await session.get(models.ExperimentPromptTask, experiment_id)
        if prompt_task is not None:
            experiment_job: models.ExperimentJob = prompt_task
            llm_client = await get_playground_client(
                model_provider=prompt_task.model_provider,
                model_name=prompt_task.model_name,
                session=session,
                decrypt=self._decrypt,
                credentials=credentials,
                connection=(prompt_task.connection or prompt_task.custom_provider_id),
            )
        else:
            eval_config = await session.get(models.ExperimentEvalOnlyConfig, experiment_id)
            if eval_config is not None:
                experiment_job = eval_config
                llm_client = _NO_OP_LLM_CLIENT
            else:
                raise ValueError(f"No ExperimentJob for experiment {experiment_id}")

        dataset_evaluators_result = await session.scalars(
            select(models.DatasetEvaluators)
            .join(
                models.ExperimentDatasetEvaluator,
                models.DatasetEvaluators.id
                == models.ExperimentDatasetEvaluator.dataset_evaluator_id,
            )
            .where(models.ExperimentDatasetEvaluator.experiment_id == experiment_id)
        )
        dataset_evaluators = dataset_evaluators_result.all()

        evaluator_run_specs: list[EvaluatorRunSpec] = []
        if dataset_evaluators:
            dataset_evaluator_ids = [de.id for de in dataset_evaluators]
            evaluators = await get_evaluators(
                dataset_evaluator_ids=dataset_evaluator_ids,
                session=session,
                decrypt=self._decrypt,
                credentials=credentials,
            )
            evaluator_run_specs = [
                EvaluatorRunSpec(
                    dataset_evaluator_id=de.id,
                    evaluator=ev,
                    input_mapping=de.input_mapping,
                    output_configs=_output_configs_for_eval_run(de, ev),
                    evaluator_project_id=de.project_id,
                )
                for de, ev in zip(dataset_evaluators, evaluators)
            ]

        logger.debug(
            f"Loaded {len(evaluator_run_specs)} evaluator(s) for experiment "
            f"{experiment_id} ({len(dataset_evaluators)} dataset "
            f"evaluator(s) from junction)"
        )

        return experiment_job, llm_client, evaluator_run_specs

    # === Public API ===

    @overload
    async def start_experiment(
        self,
        experiment_id: int,
        *,
        credentials: Sequence[GenerativeCredentialInput] | None = None,
        subscribe: Literal[True] = True,
    ) -> tuple[RunningExperiment, MemoryObjectReceiveStream[ChatCompletionSubscriptionPayload]]: ...

    @overload
    async def start_experiment(
        self,
        experiment_id: int,
        *,
        credentials: Sequence[GenerativeCredentialInput] | None = None,
        subscribe: Literal[False],
    ) -> RunningExperiment: ...

    async def start_experiment(
        self,
        experiment_id: int,
        *,
        credentials: Sequence[GenerativeCredentialInput] | None = None,
        subscribe: bool = False,
    ) -> (
        tuple[RunningExperiment, MemoryObjectReceiveStream[ChatCompletionSubscriptionPayload]]
        | RunningExperiment
    ):
        """Register and start a new experiment.

        Args:
            experiment_id: Primary key of the experiment (same as ``ExperimentJob.id``).
            credentials: Ephemeral API credentials (not stored, passed at runtime).
            subscribe: If True, returns a subscription stream to receive chunks.
                       Subscribe before work starts to avoid missing early chunks.

        Returns:
            If subscribe=True: (experiment, receive_stream) tuple
            If subscribe=False: just the experiment
        """
        logger.info(
            f"start_experiment({experiment_id}) called, "
            f"subscribe={subscribe}, has_credentials={credentials is not None}"
        )

        async with self._db() as session:
            experiment = await self._claim_experiment(session, experiment_id)
            experiment_job, llm_client, evaluator_run_specs = await self._load_experiment_config(
                session, experiment_id, credentials
            )
            session.expunge(experiment)
            session.expunge(experiment_job)

        exp = RunningExperiment(
            experiment=experiment,
            experiment_job=experiment_job,
            llm_client=llm_client,
            db=self._db,
            decrypt=self._decrypt,
            tracer_factory=self._tracer_factory,
            token_buckets=self._token_buckets,
            on_done=self._on_experiment_done,
            credentials=credentials,
            evaluator_run_specs=evaluator_run_specs,
        )

        # Subscribe BEFORE registering - guarantees no missed chunks
        receive_stream = exp.subscribe() if subscribe else None

        self._experiments[experiment_id] = exp
        self._work_available.set()  # Wake dispatch loop
        logger.info(
            f"Started experiment {experiment_id} (replica={self._replica_id}, "
            f"subscribe={subscribe}, total_active={len(self._experiments)})"
        )

        if subscribe:
            assert receive_stream is not None
            return exp, receive_stream
        return exp

    async def _heartbeat_loop(self) -> None:
        """
        Periodically refresh claimed_at for running experiments we own.

        Also detects lost ownership (cross-replica stop, deleted, etc.)
        and cancels local experiments we no longer own.
        """
        while True:
            # Jitter prevents thundering herd when multiple replicas
            # started around the same time (same pattern as orphan scan).
            jitter = random.uniform(0, self.HEARTBEAT_JITTER.total_seconds())
            await anyio.sleep(self.HEARTBEAT_INTERVAL.total_seconds() + jitter)
            if not self._experiments:
                logger.debug("Heartbeat: no experiments in memory, skipping")
                continue

            try:
                experiment_ids = list(self._experiments.keys())
                now = datetime.now(timezone.utc)
                logger.debug(
                    f"Heartbeat: refreshing {len(experiment_ids)} experiments: {experiment_ids}"
                )

                # UPDATE only experiments we own that are still running
                # RETURNING tells us which ones were actually updated
                with anyio.fail_after(5, shield=True):
                    async with self._db() as session:
                        stmt = (
                            update(models.ExperimentJob)
                            .where(models.ExperimentJob.id.in_(experiment_ids))
                            .where(models.ExperimentJob.claimed_by == self._replica_id)
                            .where(models.ExperimentJob.claimed_at.is_not(None))
                            .values(claimed_at=now)
                            .returning(models.ExperimentJob.id)
                        )
                        result = await session.execute(stmt)
                        updated_ids = {row.id for row in result}

                logger.debug(
                    f"Heartbeat: UPDATE affected {len(updated_ids)} rows: {updated_ids} "
                    f"(WHERE id IN {experiment_ids} AND claimed_by={self._replica_id} "
                    f"AND claimed_at IS NOT NULL)"
                )

                # Any experiment in memory but NOT updated = we lost ownership
                lost_ownership = set(experiment_ids) - updated_ids
                if lost_ownership:
                    logger.warning(
                        f"Heartbeat: detected lost ownership for "
                        f"{len(lost_ownership)} experiments: "
                        f"{lost_ownership} (in memory but not updated by heartbeat)"
                    )
                for exp_id in lost_ownership:
                    logger.info(
                        f"Lost ownership of experiment {exp_id} "
                        f"(not in updated_ids), cancelling local state"
                    )
                    if exp := self._experiments.pop(exp_id, None):
                        exp.stop()

                if updated_ids:
                    logger.debug(
                        f"Heartbeat: successfully refreshed {len(updated_ids)} experiments"
                    )
            except Exception:
                logger.exception("Heartbeat failed, will retry next interval")

    async def _orphan_scan_loop(self) -> None:
        """
        Periodically scan for orphaned experiments from crashed replicas.

        Unlike startup recovery, this runs continuously to catch experiments
        orphaned by other replicas that crash while this server is running.

        Uses jitter to avoid thundering herd when multiple replicas scan simultaneously.
        """
        while True:
            # Random jitter to spread out scans across replicas
            jitter_seconds = random.uniform(0, self.ORPHAN_SCAN_JITTER.total_seconds())
            sleep_seconds = self.ORPHAN_SCAN_INTERVAL.total_seconds() + jitter_seconds
            logger.debug(
                f"Orphan scan: sleeping {sleep_seconds:.1f}s "
                f"(base={self.ORPHAN_SCAN_INTERVAL.total_seconds()}s, jitter={jitter_seconds:.1f}s)"
            )
            await anyio.sleep(sleep_seconds)

            try:
                await self._resume_orphaned()
            except Exception:
                logger.exception("Orphan scan failed, will retry next interval")

    async def stop_experiment(self, experiment_id: int) -> bool:
        """Stop a running experiment and wait for in-flight shielded writes to drain.

        Removes experiment from _experiments dict so heartbeat doesn't try to
        refresh it (which would fail since claimed_at=NULL in DB).
        """
        logger.info(
            f"stop_experiment({experiment_id}) called, "
            f"in_memory={experiment_id in self._experiments}, "
            f"all_experiments={list(self._experiments.keys())}"
        )
        if exp := self._experiments.pop(experiment_id, None):
            logger.info(f"stop_experiment({experiment_id}): found in registry, calling stop()")
            exp.stop()
            # Wait for shielded DB writes to complete before returning.
            with anyio.fail_after(10):  # slightly longer than the 5s shield timeout
                await exp._drained.wait()
            logger.info(f"stop_experiment({experiment_id}): drained")
            return True
        logger.warning(
            f"stop_experiment({experiment_id}): NOT FOUND in registry (already stopped/completed?)"
        )
        return False

    async def _on_experiment_done(
        self,
        experiment_id: int,
        *,
        error_message: str | None = None,
        error_category: str | None = None,
    ) -> None:
        """
        Callback when experiment stops (naturally or due to error).

        Called from _check_completion() when all work is done,
        or from _handle_circuit_trip() when circuit breaker trips.
        Performs the DB write directly (caller is always in the task group).
        """
        self._experiments.pop(experiment_id, None)
        logger.debug(f"Experiment {experiment_id} done, removed from registry")
        await self._set_experiment_stopped(
            experiment_id,
            error_message=error_message,
            error_category=error_category,
        )

    async def _set_experiment_stopped(
        self,
        experiment_id: int,
        *,
        error_message: str | None = None,
        error_category: str | None = None,
    ) -> None:
        """
        Set experiment to stopped (claimed_at=NULL) in database.

        Uses CONDITIONAL update (WHERE claimed_by = self._replica_id) to avoid
        clobbering another replica's running experiment during ownership transitions.
        If we've lost ownership, the update affects 0 rows - which is correct.
        """
        if error_message:
            logger.warning(f"Experiment {experiment_id} stopping with error: {error_message}")

        status = "ERROR" if error_message else "COMPLETED"

        # CONDITIONAL update: only if we still own it
        # This prevents clobbering another replica's running experiment
        stmt = (
            update(models.ExperimentJob)
            .where(models.ExperimentJob.id == experiment_id)
            .where(models.ExperimentJob.claimed_by == self._replica_id)
            .values(claimed_at=None, claimed_by=None, status=status)
            .returning(models.ExperimentJob.id)
        )
        try:
            with anyio.fail_after(5, shield=True):
                async with self._db() as session:
                    updated = await session.scalar(stmt)
                    if updated and error_message:
                        session.add(
                            models.ExperimentJobLog(
                                experiment_id=experiment_id,
                                level="ERROR",
                                message=error_message,
                            )
                        )

            if updated:
                logger.debug(f"Set claimed_at=NULL for experiment {experiment_id}")
            else:
                # We lost ownership - another replica owns it or it was already stopped
                # The error was logged above, so debugging is still possible
                logger.debug(
                    f"Conditional update for experiment {experiment_id} affected 0 rows "
                    f"(lost ownership or already stopped)"
                )
        except Exception:
            logger.exception(f"Failed to stop experiment {experiment_id}")

    @property
    def replica_id(self) -> str:
        return self._replica_id
