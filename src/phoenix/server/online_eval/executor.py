"""Execution glue for claimed online-eval work units: configuration-first hydration,
target context assembly, evaluator invocation, and idempotent annotation writes.
Publication runs through the coordinator, which fences the claim and records any
coverage watermark in the same transaction; every lifecycle transition, including
completion, stays with the coordinator and its caller.
"""

from __future__ import annotations

import asyncio
import logging
from collections import Counter
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncIterator, Callable, Literal, Mapping, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, with_polymorphic
from strawberry.relay import GlobalID

from phoenix.config import (
    get_env_online_eval_max_llm_message_bytes,
    get_env_online_eval_max_sandbox_payload_bytes,
)
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    OutputConfigType,
    as_output_configs,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.prompts import PromptChatTemplate
from phoenix.server.api.evaluators import (
    BaseEvaluator,
    CodeEvaluatorRunner,
    EvaluationResult,
    LLMEvaluator,
    get_builtin_evaluator_by_key,
)
from phoenix.server.api.helpers.playground_clients import get_playground_client
from phoenix.server.dml_event import (
    DmlEvent,
    ProjectSessionAnnotationInsertEvent,
    SpanAnnotationInsertEvent,
)
from phoenix.server.online_eval.bound_variables import (
    SPAN_BOUND_VARIABLE_NAMES,
    load_session_bound_variables,
    session_duration_ms,
)
from phoenix.server.online_eval.coordinator import ClaimedWorkUnit, EvalWorkCoordinator
from phoenix.server.online_eval.derivation import (
    STALE_FINGERPRINT_ERROR,
    config_fingerprint,
)
from phoenix.server.online_eval.failure_policy import FailureDisposition
from phoenix.server.online_eval.project_evaluator_resolution import resolve_project_evaluators_bulk
from phoenix.server.online_eval.session_policy import (
    ONLINE_SANDBOX_PAYLOAD_LIMIT_REMEDIATION,
    SessionEvalPolicy,
    session_project_evaluator_is_schedulable,
)
from phoenix.server.online_eval.tracing import (
    marked_evaluator_tracer,
    persist_evaluator_traces,
)
from phoenix.server.sandbox import SecretsContext, build_sandbox_backend
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import CanPutItem, DbSessionFactory
from phoenix.tracers import Tracer

logger = logging.getLogger(__name__)

_EMPTY_INPUT_MAPPING = InputMapping(literal_mapping={}, path_mapping={})
_SESSION_POLICY_METADATA_KEY = "phoenix.online_eval.session_policy"
_EVALUATOR_TRACE_ID_METADATA_KEY = "phoenix.evaluator_trace_id"
_DEFAULT_EXECUTION_DEADLINE_SECONDS = 600.0

AnnotatorKind = Literal["LLM", "CODE"]
EvaluatorKind = Literal["LLM", "CODE", "BUILTIN"]


class EvalExecutionError(Exception):
    """The evaluator ran but produced no writable result."""


class EvaluatorResultValidationError(EvalExecutionError):
    """The evaluator returned a result that violates its output contract."""

    online_eval_disposition = FailureDisposition(
        count_attempt=True,
        code="EVALUATOR_RESULT_INVALID",
    )


class OnlineEvalStoragePaused(Exception):
    """Publication is paused while database insertions and updates are blocked."""


class HydrationFailureReason(str, Enum):
    PROJECT_EVALUATOR_MISSING = "PROJECT_EVALUATOR_MISSING"
    PROJECT_EVALUATOR_DISABLED = "PROJECT_EVALUATOR_DISABLED"
    PROJECT_EVALUATOR_NOT_SCHEDULABLE = "PROJECT_EVALUATOR_NOT_SCHEDULABLE"
    EVALUATOR_MISSING = "EVALUATOR_MISSING"
    EVALUATOR_VERSION_MISSING = "EVALUATOR_VERSION_MISSING"
    SANDBOX_RUNTIME_UNAVAILABLE = "SANDBOX_RUNTIME_UNAVAILABLE"
    # The producer's revival scan matches this exact text on an EXPIRED row, so a
    # project evaluator edited and reverted re-materializes rather than staying terminal.
    CONFIG_FINGERPRINT_MISMATCH = STALE_FINGERPRINT_ERROR
    SPAN_MISSING = "SPAN_MISSING"
    SESSION_MISSING = "SESSION_MISSING"
    SESSION_PROJECT_MISMATCH = "SESSION_PROJECT_MISMATCH"
    SESSION_CONTENT_INCOMPLETE = "SESSION_CONTENT_INCOMPLETE"
    UNSUPPORTED_TARGET = "UNSUPPORTED_TARGET"
    NO_ROOT_TURNS = "NO_ROOT_TURNS"


@dataclass(frozen=True)
class HydrationFailure:
    reason: HydrationFailureReason
    detail: str = ""


@dataclass(frozen=True)
class HydratedWorkUnit:
    """Everything one eval needs, copied out of the mutable project-evaluator/evaluator
    rows while the staleness guard held. The executor never re-reads those rows
    after hydration, so the eval runs under snapshot semantics."""

    annotation_name: str
    annotator_kind: AnnotatorKind
    evaluator_kind: EvaluatorKind
    evaluator: BaseEvaluator
    input_mapping: InputMapping
    output_configs: Sequence[OutputConfigType]
    context: dict[str, Any]
    annotation_metadata: dict[str, Any] = field(default_factory=dict)


HydrationOutcome = HydratedWorkUnit | HydrationFailure


@dataclass(frozen=True)
class _HydratedEvaluatorSnapshot:
    annotator_kind: AnnotatorKind
    evaluator_kind: EvaluatorKind
    evaluator: BaseEvaluator
    output_configs: tuple[OutputConfigType, ...]


@dataclass(frozen=True)
class HydratedConfigurationSnapshot:
    """Immutable evaluator configuration observed for one claim batch."""

    project_id: int
    fingerprint: str
    annotation_name: str
    evaluator: _HydratedEvaluatorSnapshot
    input_mapping: InputMapping
    context: dict[str, Any]
    annotation_metadata: dict[str, Any]


@dataclass(frozen=True)
class SharedHydrationFailure:
    """A batch-level database failure that must not consume any unit's retry budget."""

    error: Exception


ConfigurationSnapshotOutcome = (
    HydratedConfigurationSnapshot | HydrationFailure | SharedHydrationFailure | Exception
)


@dataclass(frozen=True)
class SessionEvalContext:
    """A session's bindable context and the record of what was loaded to build it."""

    context: dict[str, Any]
    applied_policy: dict[str, Any]


def span_eval_context(span: models.Span, *, trace_id: str) -> dict[str, Any]:
    """Span context: the span's own input and output, and everything else under
    ``metadata`` — the filter language's scalar names beside the span record."""
    entity = {
        "span_id": span.span_id,
        "trace_id": trace_id,
        "parent_id": span.parent_id,
        "name": span.name,
        "span_kind": span.span_kind,
        "status_code": span.status_code,
        "status_message": span.status_message,
        "latency_ms": span.latency_ms,
        "start_time": span.start_time.isoformat(),
        "end_time": span.end_time.isoformat(),
        "cumulative_llm_token_count_prompt": span.cumulative_llm_token_count_prompt,
        "cumulative_llm_token_count_completion": span.cumulative_llm_token_count_completion,
        "cumulative_llm_token_count_total": span.cumulative_llm_token_count_total,
        "input_value": span.input_value,
        "output_value": span.output_value,
        "attributes": span.attributes,
        "events": span.events,
    }
    return {
        "input": span.input_value,
        "output": span.output_value,
        "metadata": {
            **{name: entity[name] for name in sorted(SPAN_BOUND_VARIABLE_NAMES)},
            "span": entity,
        },
    }


def session_eval_context(
    *,
    project_session: models.ProjectSession,
    turns: Sequence[dict[str, Any]],
    policy: SessionEvalPolicy,
    vocabulary: Mapping[str, Any],
    total_eligible_root_count: Optional[int] = None,
) -> SessionEvalContext:
    """Session context. ``input`` and ``output`` bind the values the session filter
    language spells ``first_input`` and ``last_output``, so one concept keeps one
    spelling across a filter, a preview, and an evaluation. ``vocabulary`` must
    carry every name in ``SESSION_BOUND_VARIABLE_NAMES``.

    The applied policy is returned beside the context rather than inside it: it is
    published on the annotation, not bound by the evaluator, and every top-level
    context key is bindable.
    """
    total_root_count = (
        len(turns) if total_eligible_root_count is None else total_eligible_root_count
    )
    entity = {
        "session_id": project_session.session_id,
        "start_time": project_session.start_time.isoformat(),
        "end_time": project_session.end_time.isoformat(),
        "duration_ms": session_duration_ms(
            project_session.start_time,
            project_session.end_time,
        ),
        "turns": list(turns),
    }
    applied_policy = {
        "version": policy.version,
        "ordering": "trace_start_time_then_trace_id_with_earliest_root_span",
        "max_turns": policy.max_turns,
        "total_eligible_root_count": total_root_count,
        "loaded_turn_count": len(turns),
        "turn_cap_omitted_count": max(0, total_root_count - len(turns)),
        "first_loaded_event_time": turns[0].get("event_time") if turns else None,
        "last_loaded_event_time": turns[-1].get("event_time") if turns else None,
    }
    return SessionEvalContext(
        context={
            "input": vocabulary["first_input"],
            "output": vocabulary["last_output"],
            "metadata": {**vocabulary, "session": entity},
        },
        applied_policy=applied_policy,
    )


async def load_session_eval_context(
    session: AsyncSession,
    *,
    project_session_rowid: int,
    project_id: int,
    policy: SessionEvalPolicy,
    vocabulary: Mapping[str, Any],
) -> SessionEvalContext:
    """The session's evaluation context, exactly as an online evaluation reads it.

    The executor and the GraphQL preview field both call this, so what an author
    previews is the same session document, turn ordering, and turn cap the runtime
    binds against. ``vocabulary`` is supplied by the caller because the executor
    reads it for a whole batch of sessions at once.
    """
    project_session = await session.get(models.ProjectSession, project_session_rowid)
    if project_session is None:
        raise ValueError(f"Project session {project_session_rowid} no longer exists")
    root_filters = (
        models.Trace.project_session_rowid == project_session_rowid,
        models.Trace.project_rowid == project_id,
        models.Span.parent_id.is_(None),
    )
    # Counted rather than derived from the loaded turns because the turns are
    # capped: the difference is what `turn_cap_omitted_count` reports on every
    # published annotation, telling a reader how much of the session the score
    # did not see.
    total_eligible_root_count = (
        await session.scalar(
            select(func.count(func.distinct(models.Trace.id)))
            .select_from(models.Span)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(*root_filters)
        )
        or 0
    )
    ranked_roots = (
        select(
            models.Span.input_value,
            models.Span.output_value,
            models.Span.metadata_,
            models.Span.start_time.label("event_time"),
            models.Span.span_id,
            models.Trace.start_time.label("trace_start_time"),
            models.Trace.id.label("trace_id"),
            func.row_number()
            .over(
                partition_by=models.Trace.id,
                order_by=(models.Span.start_time.asc(), models.Span.span_id.asc()),
            )
            .label("root_rank"),
        )
        .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
        .where(*root_filters)
        .subquery()
    )
    root_rows = (
        await session.execute(
            select(
                ranked_roots.c.input_value,
                ranked_roots.c.output_value,
                ranked_roots.c.metadata_,
                ranked_roots.c.event_time,
                ranked_roots.c.span_id,
            )
            .where(ranked_roots.c.root_rank == 1)
            .order_by(
                ranked_roots.c.trace_start_time.desc(),
                ranked_roots.c.trace_id.desc(),
            )
            .limit(policy.max_turns)
        )
    ).all()
    turns = [
        {
            "input": row.input_value,
            "output": row.output_value,
            "metadata": row.metadata_,
            "event_time": row.event_time.isoformat(),
            "span_id": row.span_id,
        }
        for row in reversed(root_rows)
    ]
    return session_eval_context(
        project_session=project_session,
        turns=turns,
        policy=policy,
        vocabulary=vocabulary,
        total_eligible_root_count=total_eligible_root_count,
    )


def has_eligible_root_turns(applied_policy: Mapping[str, Any]) -> bool:
    """Whether a loaded session has a turn to evaluate.

    A session whose traces carry no root span loads no turns. Live hydration
    refuses it (``NO_ROOT_TURNS``) rather than evaluating that emptiness, so the
    preview field reads the same predicate and reports the session as unevaluable
    instead of offering the empty context. Reading it off the applied policy
    keeps one spelling of the question, though an empty count and an empty turn
    list always agree.
    """
    return bool(applied_policy["total_eligible_root_count"])


def _evaluator_trace_metadata(result: EvaluationResult) -> dict[str, Any]:
    """The evaluator trace this annotation came from, for readers that want to
    open the evaluation behind a score."""
    trace_id = result.get("trace_id")
    return {_EVALUATOR_TRACE_ID_METADATA_KEY: trace_id} if trace_id else {}


def _session_coverage_watermark(hydrated: HydratedWorkUnit) -> Optional[datetime]:
    """Newest root-span time actually loaded into the evaluated session.

    A session row is materialized with ``evaluated_through`` set to the ingest
    watermark seen at sweep time, but the session is loaded later and can cover
    more; publication records what the annotation read separately.
    """
    policy = hydrated.annotation_metadata.get(_SESSION_POLICY_METADATA_KEY)
    if not isinstance(policy, dict):
        return None
    last_loaded_event_time = policy.get("last_loaded_event_time")
    if not isinstance(last_loaded_event_time, str):
        return None
    try:
        watermark = datetime.fromisoformat(last_loaded_event_time)
    except ValueError:
        return None
    return watermark if watermark.tzinfo is not None else watermark.replace(tzinfo=timezone.utc)


class OnlineEvalExecutor:
    """Hydrates and executes claimed work units against the eval runtime."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        coordinator: EvalWorkCoordinator,
        decrypt: Callable[[bytes], bytes],
        sandbox_session_manager: Optional[SandboxSessionManager] = None,
        sandbox_runtime: Optional[SandboxRuntimeContext] = None,
        event_queue: Optional[CanPutItem[DmlEvent]] = None,
        execution_deadline_seconds: float = _DEFAULT_EXECUTION_DEADLINE_SECONDS,
        db_semaphore: Optional[asyncio.Semaphore] = None,
        tracer_factory: Optional[Callable[[], Tracer]] = None,
    ) -> None:
        self._db = db
        self._coordinator = coordinator
        self._decrypt = decrypt
        self._sandbox_session_manager = sandbox_session_manager
        self._sandbox_runtime = sandbox_runtime
        self._event_queue = event_queue
        self._tracer_factory = tracer_factory
        self._execution_deadline_seconds = execution_deadline_seconds
        self._db_semaphore = db_semaphore
        self._session_policy = SessionEvalPolicy()

    async def hydrate(self, unit: ClaimedWorkUnit) -> HydrationOutcome:
        configuration = (await self.hydrate_configuration_snapshots([unit]))[0]
        if isinstance(configuration, SharedHydrationFailure):
            raise configuration.error
        if isinstance(configuration, Exception):
            raise configuration
        if isinstance(configuration, HydrationFailure):
            return configuration
        return self.hydrate_from_snapshot(configuration)

    async def hydrate_configuration_snapshots(
        self,
        units: Sequence[ClaimedWorkUnit],
    ) -> list[ConfigurationSnapshotOutcome]:
        if not units:
            return []
        try:
            async with self._db_phase():
                async with self._db() as session:
                    return await self._hydrate_configuration_snapshots(session, units)
        except Exception as error:
            return [SharedHydrationFailure(error) for _ in units]

    async def _hydrate_configuration_snapshots(
        self,
        session: AsyncSession,
        units: Sequence[ClaimedWorkUnit],
    ) -> list[ConfigurationSnapshotOutcome]:
        project_evaluator_ids = {unit.project_evaluator_id for unit in units}
        polymorphic = with_polymorphic(
            models.Evaluator,
            [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
        )
        rows = (
            await session.execute(
                select(
                    models.ProjectEvaluator,
                    polymorphic,
                    session_project_evaluator_is_schedulable(models.ProjectEvaluator).label(
                        "session_schedulable"
                    ),
                )
                .outerjoin(
                    polymorphic,
                    models.ProjectEvaluator.evaluator_id == polymorphic.id,
                )
                .where(models.ProjectEvaluator.id.in_(project_evaluator_ids))
            )
        ).all()
        rows_by_project_evaluator_id = {
            project_evaluator.id: (project_evaluator, evaluator, bool(session_schedulable))
            for project_evaluator, evaluator, session_schedulable in rows
        }

        preliminary: list[Optional[HydrationFailure]] = []
        project_evaluator_pairs: dict[int, tuple[models.ProjectEvaluator, models.Evaluator]] = {}
        for unit in units:
            row = rows_by_project_evaluator_id.get(unit.project_evaluator_id)
            failure: Optional[HydrationFailure] = None
            if row is None:
                failure = HydrationFailure(HydrationFailureReason.PROJECT_EVALUATOR_MISSING)
            else:
                project_evaluator, evaluator, session_schedulable = row
                if not project_evaluator.enabled:
                    failure = HydrationFailure(HydrationFailureReason.PROJECT_EVALUATOR_DISABLED)
                elif unit.evaluation_target == "SESSION" and not session_schedulable:
                    failure = HydrationFailure(
                        HydrationFailureReason.PROJECT_EVALUATOR_NOT_SCHEDULABLE
                    )
                elif unit.evaluation_target not in ("SPAN", "SESSION"):
                    failure = HydrationFailure(HydrationFailureReason.UNSUPPORTED_TARGET)
                elif evaluator is None:
                    failure = HydrationFailure(HydrationFailureReason.EVALUATOR_MISSING)
                elif (
                    isinstance(evaluator, models.CodeEvaluator)
                    and evaluator.sandbox_config_id is None
                ):
                    failure = HydrationFailure(HydrationFailureReason.SANDBOX_RUNTIME_UNAVAILABLE)
                else:
                    project_evaluator_pairs.setdefault(
                        project_evaluator.id, (project_evaluator, evaluator)
                    )
            preliminary.append(failure)

        project_evaluator_pair_rows = list(project_evaluator_pairs.values())
        resolved_rows = await resolve_project_evaluators_bulk(session, project_evaluator_pair_rows)
        resolved_by_project_evaluator_id = {
            project_evaluator.id: resolved
            for (project_evaluator, _), resolved in zip(
                project_evaluator_pair_rows,
                resolved_rows,
                strict=True,
            )
        }
        unresolved_failures: dict[int, HydrationFailure] = {}
        for project_evaluator_id, (_, evaluator) in project_evaluator_pairs.items():
            if resolved_by_project_evaluator_id[project_evaluator_id] is not None:
                continue
            async with session.begin_nested():
                unresolved_failures[
                    project_evaluator_id
                ] = await self._unresolved_configuration_failure(
                    session,
                    evaluator,
                )

        matching_project_evaluator_ids: set[int] = set()
        outcomes: list[Optional[ConfigurationSnapshotOutcome]] = []
        for unit, failure in zip(units, preliminary, strict=True):
            if failure is not None:
                outcomes.append(failure)
                continue
            resolved = resolved_by_project_evaluator_id[unit.project_evaluator_id]
            if resolved is None:
                outcomes.append(unresolved_failures[unit.project_evaluator_id])
                continue
            try:
                fingerprint = config_fingerprint(resolved)
            except Exception as error:
                outcomes.append(error)
                continue
            if fingerprint != unit.config_fingerprint:
                outcomes.append(
                    HydrationFailure(HydrationFailureReason.CONFIG_FINGERPRINT_MISMATCH)
                )
                continue
            outcomes.append(None)

        session_vocabularies: dict[int, dict[str, Any]] = {}
        session_indices = [
            index
            for index, (unit, outcome) in enumerate(zip(units, outcomes, strict=True))
            if outcome is None and unit.evaluation_target == "SESSION"
        ]
        if session_indices:
            try:
                # One savepointed batch read: a failure here is infrastructure,
                # not a property of any one session's data.
                async with session.begin_nested():
                    session_vocabularies = await load_session_bound_variables(
                        session,
                        project_session_rowids={
                            units[index].target_rowid for index in session_indices
                        },
                    )
            except Exception as error:
                for index in session_indices:
                    outcomes[index] = SharedHydrationFailure(error)

        contexts: list[Optional[dict[str, Any]]] = [None for _ in units]
        applied_policies: list[Optional[dict[str, Any]]] = [None for _ in units]
        input_mappings: list[Optional[InputMapping]] = [None for _ in units]
        for index, (unit, outcome) in enumerate(zip(units, outcomes, strict=True)):
            if outcome is not None:
                continue
            project_evaluator, _ = project_evaluator_pairs[unit.project_evaluator_id]
            try:
                async with session.begin_nested():
                    hydrated_context = await self._hydrate_target_context(
                        session,
                        unit,
                        project_id=project_evaluator.project_id,
                        session_vocabularies=session_vocabularies,
                    )
            except Exception as error:
                outcomes[index] = error
                continue
            if isinstance(hydrated_context, HydrationFailure):
                outcomes[index] = hydrated_context
                continue
            target_context, applied_policy = hydrated_context
            resolved = resolved_by_project_evaluator_id[unit.project_evaluator_id]
            assert resolved is not None
            try:
                resolved_input_mapping = (
                    InputMapping.model_validate(resolved.input_mapping)
                    if resolved.input_mapping is not None
                    else _EMPTY_INPUT_MAPPING
                )
            except Exception as error:
                outcomes[index] = error
                continue
            contexts[index] = target_context
            applied_policies[index] = applied_policy
            input_mappings[index] = resolved_input_mapping
            matching_project_evaluator_ids.add(unit.project_evaluator_id)

        evaluator_snapshots: dict[
            int, _HydratedEvaluatorSnapshot | HydrationFailure | Exception
        ] = {}
        for project_evaluator_id in matching_project_evaluator_ids:
            _, evaluator = project_evaluator_pairs[project_evaluator_id]
            if evaluator.id in evaluator_snapshots:
                continue
            resolved = resolved_by_project_evaluator_id[project_evaluator_id]
            assert resolved is not None
            try:
                async with session.begin_nested():
                    hydrated_evaluator_snapshot = await self._hydrate_evaluator_snapshot(
                        session,
                        evaluator,
                        resolved.version_ref,
                    )
            except Exception as error:
                evaluator_snapshots[evaluator.id] = error
            else:
                evaluator_snapshots[evaluator.id] = (
                    hydrated_evaluator_snapshot
                    if hydrated_evaluator_snapshot is not None
                    else HydrationFailure(HydrationFailureReason.EVALUATOR_VERSION_MISSING)
                )

        for index, (unit, outcome) in enumerate(zip(units, outcomes, strict=True)):
            if outcome is not None:
                continue
            project_evaluator, evaluator = project_evaluator_pairs[unit.project_evaluator_id]
            evaluator_snapshot_outcome = evaluator_snapshots[evaluator.id]
            if isinstance(evaluator_snapshot_outcome, (HydrationFailure, Exception)):
                outcomes[index] = evaluator_snapshot_outcome
                continue
            resolved = resolved_by_project_evaluator_id[unit.project_evaluator_id]
            assert resolved is not None
            snapshot_context = contexts[index]
            if snapshot_context is None:
                outcomes[index] = RuntimeError("Target context hydration did not produce a result")
                continue
            snapshot_input_mapping = input_mappings[index]
            if snapshot_input_mapping is None:
                outcomes[index] = RuntimeError("Input mapping hydration did not produce a result")
                continue
            snapshot_applied_policy = applied_policies[index]
            annotation_metadata: dict[str, Any] = (
                {_SESSION_POLICY_METADATA_KEY: snapshot_applied_policy}
                if snapshot_applied_policy is not None
                else {}
            )
            outcomes[index] = HydratedConfigurationSnapshot(
                project_id=project_evaluator.project_id,
                fingerprint=unit.config_fingerprint,
                annotation_name=resolved.name,
                evaluator=evaluator_snapshot_outcome,
                input_mapping=snapshot_input_mapping,
                context=snapshot_context,
                annotation_metadata=annotation_metadata,
            )
        final_outcomes: list[ConfigurationSnapshotOutcome] = []
        for outcome in outcomes:
            assert outcome is not None
            final_outcomes.append(outcome)
        return final_outcomes

    async def _unresolved_configuration_failure(
        self,
        session: AsyncSession,
        evaluator: models.Evaluator,
    ) -> HydrationFailure:
        if not isinstance(evaluator, models.CodeEvaluator):
            return HydrationFailure(HydrationFailureReason.EVALUATOR_VERSION_MISSING)
        sandbox_config_id = evaluator.sandbox_config_id
        if sandbox_config_id is None:
            return HydrationFailure(HydrationFailureReason.SANDBOX_RUNTIME_UNAVAILABLE)
        sandbox_config = await session.get(models.SandboxConfig, sandbox_config_id)
        if sandbox_config is None or not sandbox_config.enabled:
            return HydrationFailure(HydrationFailureReason.SANDBOX_RUNTIME_UNAVAILABLE)
        provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
        if provider is None or not provider.enabled:
            return HydrationFailure(HydrationFailureReason.SANDBOX_RUNTIME_UNAVAILABLE)
        return HydrationFailure(HydrationFailureReason.EVALUATOR_VERSION_MISSING)

    async def _hydrate_target_context(
        self,
        session: AsyncSession,
        unit: ClaimedWorkUnit,
        *,
        project_id: int,
        session_vocabularies: Mapping[int, Mapping[str, Any]],
    ) -> tuple[dict[str, Any], Optional[dict[str, Any]]] | HydrationFailure:
        """The bindable context, plus the applied session policy for a SESSION unit."""
        if unit.evaluation_target == "SPAN":
            span = await session.get(
                models.Span,
                unit.target_rowid,
                options=[joinedload(models.Span.trace)],
            )
            if span is None:
                return HydrationFailure(HydrationFailureReason.SPAN_MISSING)
            return span_eval_context(span, trace_id=span.trace.trace_id), None
        project_session = await session.get(models.ProjectSession, unit.target_rowid)
        if project_session is None:
            return HydrationFailure(HydrationFailureReason.SESSION_MISSING)
        if project_session.project_id != project_id:
            return HydrationFailure(HydrationFailureReason.SESSION_PROJECT_MISMATCH)
        if not project_session.content_complete:
            return HydrationFailure(HydrationFailureReason.SESSION_CONTENT_INCOMPLETE)
        loaded = await load_session_eval_context(
            session,
            project_session_rowid=project_session.id,
            project_id=project_id,
            policy=self._session_policy,
            vocabulary=session_vocabularies[unit.target_rowid],
        )
        if not has_eligible_root_turns(loaded.applied_policy):
            return HydrationFailure(HydrationFailureReason.NO_ROOT_TURNS)
        return loaded.context, loaded.applied_policy

    def hydrate_from_snapshot(
        self,
        configuration: HydratedConfigurationSnapshot,
    ) -> HydratedWorkUnit:
        return HydratedWorkUnit(
            annotation_name=configuration.annotation_name,
            annotator_kind=configuration.evaluator.annotator_kind,
            evaluator_kind=configuration.evaluator.evaluator_kind,
            evaluator=configuration.evaluator.evaluator,
            input_mapping=configuration.input_mapping,
            output_configs=configuration.evaluator.output_configs,
            context=configuration.context,
            annotation_metadata=configuration.annotation_metadata,
        )

    async def _hydrate_evaluator_snapshot(
        self,
        session: AsyncSession,
        evaluator_orm: models.Evaluator,
        version_ref: Any,
    ) -> Optional[_HydratedEvaluatorSnapshot]:
        if isinstance(evaluator_orm, models.LLMEvaluator):
            if isinstance(version_ref, int):
                prompt_version_id = version_ref
            elif (
                isinstance(version_ref, list)
                and len(version_ref) == 3
                and isinstance(version_ref[0], int)
                and isinstance(version_ref[1], int)
                and isinstance(version_ref[2], str)
            ):
                prompt_version_id = version_ref[0]
            else:
                return None
            return await self._hydrate_llm(session, evaluator_orm, prompt_version_id)
        if isinstance(evaluator_orm, models.CodeEvaluator):
            if (
                not isinstance(version_ref, list)
                or len(version_ref) != 2
                or not isinstance(version_ref[0], int)
                or not isinstance(version_ref[1], str)
            ):
                return None
            return await self._hydrate_code(
                session,
                evaluator_orm,
                version_ref[0],
                max_payload_bytes=get_env_online_eval_max_sandbox_payload_bytes(),
            )
        if isinstance(evaluator_orm, models.BuiltinEvaluator):
            return self._hydrate_builtin(evaluator_orm)
        return None

    async def _hydrate_llm(
        self,
        session: AsyncSession,
        evaluator_orm: models.LLMEvaluator,
        prompt_version_id: int,
    ) -> Optional[_HydratedEvaluatorSnapshot]:
        prompt_version = await session.get(models.PromptVersion, prompt_version_id)
        if prompt_version is None:
            return None
        prompt = await session.get(models.Prompt, evaluator_orm.prompt_id)
        if prompt is None:
            return None
        template = prompt_version.template
        if not isinstance(template, PromptChatTemplate):
            raise ValueError(
                f"LLM evaluator {evaluator_orm.id}: prompt version {prompt_version.id} "
                "does not carry a chat template"
            )
        tools = prompt_version.tools
        if tools is None:
            raise ValueError(
                f"LLM evaluator {evaluator_orm.id}: prompt version {prompt_version.id} has no tools"
            )
        llm_client = await get_playground_client(
            model_provider=prompt_version.model_provider,
            model_name=prompt_version.model_name,
            session=session,
            decrypt=self._decrypt,
            connection=prompt_version.custom_provider_id,
        )
        evaluator = LLMEvaluator(
            name=evaluator_orm.name.root,
            description=evaluator_orm.description,
            template=template,
            template_format=prompt_version.template_format,
            tools=tools,
            invocation_parameters=prompt_version.invocation_parameters,
            model_provider=prompt_version.model_provider,
            llm_client=llm_client,
            output_configs=evaluator_orm.output_configs,
            prompt_name=prompt.name.root,
            max_message_bytes=get_env_online_eval_max_llm_message_bytes(),
        )
        return _HydratedEvaluatorSnapshot(
            annotator_kind="LLM",
            evaluator_kind="LLM",
            evaluator=evaluator,
            output_configs=tuple(evaluator_orm.output_configs),
        )

    async def _hydrate_code(
        self,
        session: AsyncSession,
        evaluator_orm: models.CodeEvaluator,
        code_version_id: int,
        *,
        max_payload_bytes: int | None = None,
    ) -> Optional[_HydratedEvaluatorSnapshot]:
        if self._sandbox_session_manager is None:
            raise ValueError(
                f"Code evaluator {evaluator_orm.id}: no sandbox session manager available"
            )
        code_version = await session.get(models.CodeEvaluatorVersion, code_version_id)
        if code_version is None:
            return None
        if evaluator_orm.sandbox_config_id is None:
            raise ValueError(f"Code evaluator {evaluator_orm.id} has no sandbox config")
        sandbox_config = await session.get(models.SandboxConfig, evaluator_orm.sandbox_config_id)
        if sandbox_config is None or not sandbox_config.enabled:
            raise ValueError(
                f"Code evaluator {evaluator_orm.id}: sandbox config "
                f"{evaluator_orm.sandbox_config_id} is missing or disabled"
            )
        provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
        if provider is None or not provider.enabled:
            raise ValueError(
                f"Code evaluator {evaluator_orm.id}: sandbox provider "
                f"{sandbox_config.backend_type!r} is missing or disabled"
            )
        backend = await build_sandbox_backend(
            sandbox_config,
            secrets=SecretsContext(session=session, decrypt=self._decrypt),
            runtime=self._sandbox_runtime,
        )
        if backend is None:
            raise ValueError(
                f"Code evaluator {evaluator_orm.id}: no sandbox backend available for "
                f"config {sandbox_config.id}"
            )
        output_configs: list[OutputConfigType] = as_output_configs(evaluator_orm.output_configs)
        backend_timeout = min(
            sandbox_config.timeout,
            max(1, int(self._execution_deadline_seconds * 0.9)),
        )
        runner_timeout = min(
            self._execution_deadline_seconds * 0.95,
            backend_timeout + max(1.0, backend_timeout * 0.05),
        )
        evaluator = CodeEvaluatorRunner(
            name=evaluator_orm.name.root,
            description=evaluator_orm.description,
            source_code=code_version.source_code,
            stored_output_configs=output_configs,
            sandbox_backend=backend,
            language=evaluator_orm.language,
            sandbox_session_manager=self._sandbox_session_manager,
            timeout=backend_timeout,
            runner_timeout=runner_timeout,
            evaluator_version_id=str(GlobalID("CodeEvaluatorVersion", str(code_version.id))),
            session_key=(
                f"online-eval:{evaluator_orm.id}:{self._sandbox_session_manager.replica_id}"
            ),
            max_payload_bytes=max_payload_bytes,
            payload_limit_remediation=ONLINE_SANDBOX_PAYLOAD_LIMIT_REMEDIATION,
        )
        return _HydratedEvaluatorSnapshot(
            annotator_kind="CODE",
            evaluator_kind="CODE",
            evaluator=evaluator,
            output_configs=tuple(output_configs),
        )

    def _hydrate_builtin(
        self,
        evaluator_orm: models.BuiltinEvaluator,
    ) -> _HydratedEvaluatorSnapshot:
        evaluator_cls = get_builtin_evaluator_by_key(evaluator_orm.key)
        if evaluator_cls is None:
            raise ValueError(f"Built-in evaluator key {evaluator_orm.key!r} is not in the registry")
        return _HydratedEvaluatorSnapshot(
            annotator_kind="CODE",
            evaluator_kind="BUILTIN",
            evaluator=evaluator_cls(),
            output_configs=tuple(evaluator_orm.output_configs),
        )

    async def evaluate_and_annotate(
        self, unit: ClaimedWorkUnit, hydrated: HydratedWorkUnit
    ) -> None:
        """Run the eval and publish successful results as target annotations under
        the unit's identifier. Span results are first-write-wins; session results
        replace a prior attempt so the annotation stays paired with its coverage.
        Raises before writing unless the evaluator returns one complete, error-free
        result set. No DB session is open while the evaluator runs."""
        tracer = (
            marked_evaluator_tracer(
                self._tracer_factory(),
                project_evaluator_rowid=unit.project_evaluator_id,
                project_evaluator_name=hydrated.annotation_name,
            )
            if self._tracer_factory
            else None
        )
        try:
            results = await hydrated.evaluator.evaluate(
                context=hydrated.context,
                input_mapping=hydrated.input_mapping,
                name=hydrated.annotation_name,
                output_configs=hydrated.output_configs,
                tracer=tracer,
            )
        finally:
            if tracer is not None:
                # A failed evaluation is exactly when its trace is worth reading,
                # so the trace is written whether or not the evaluation succeeded —
                # including when the consumer cancels the evaluation at its
                # execution deadline, which is why the write is shielded: an
                # unshielded await would re-raise the cancellation before the
                # persist ran, dropping the trace of exactly the run a user
                # would want to debug.
                persist = asyncio.ensure_future(
                    self._persist_evaluator_traces(tracer, unit.project_evaluator_id)
                )
                try:
                    await asyncio.shield(persist)
                except asyncio.CancelledError:
                    if not persist.done():
                        await asyncio.wait([persist])
                    raise
        errored = [result for result in results if result["error"] is not None]
        if errored:
            raise EvalExecutionError(errored[0]["error"]) from errored[0].get("error_exc")
        if hydrated.evaluator_kind != "BUILTIN":
            # Built-ins retain their evaluator-defined result-name contract.
            multi_output = len(hydrated.output_configs) > 1
            output_configs_by_name = {
                (
                    f"{hydrated.annotation_name}.{config.name}"
                    if multi_output
                    else hydrated.annotation_name
                ): config
                for config in hydrated.output_configs
            }
            returned_name_counts = Counter(result["name"] for result in results)
            invalid_counts = {
                name: returned_name_counts.get(name, 0)
                for name in output_configs_by_name
                if returned_name_counts.get(name, 0) != 1
            }
            unexpected = sorted(returned_name_counts.keys() - output_configs_by_name.keys())
            if invalid_counts or unexpected:
                raise EvaluatorResultValidationError(
                    "evaluator returned an invalid result set: "
                    f"counts={invalid_counts}, unexpected={unexpected}"
                )
            for result in results:
                output_config = output_configs_by_name[result["name"]]
                if not isinstance(output_config, CategoricalOutputConfig):
                    continue
                label = result["label"]
                allowed_labels = {value.label for value in output_config.values}
                if not isinstance(label, str) or label not in allowed_labels:
                    raise EvaluatorResultValidationError(
                        f"categorical output {result['name']!r} returned invalid label "
                        f"{label!r}; expected one of {sorted(allowed_labels)!r}"
                    )
        if unit.evaluation_target == "SPAN":
            target_values = {"span_rowid": unit.target_rowid}
        elif unit.evaluation_target == "SESSION":
            target_values = {"project_session_id": unit.target_rowid}
        else:
            raise EvalExecutionError(
                f"unsupported online evaluation target {unit.evaluation_target!r}"
            )
        records = [
            {
                **target_values,
                "name": result["name"],
                "label": result["label"],
                "score": result["score"],
                "explanation": result["explanation"],
                "metadata_": {
                    **result["metadata"],
                    **hydrated.annotation_metadata,
                    **_evaluator_trace_metadata(result),
                },
                "annotator_kind": hydrated.annotator_kind,
                "identifier": unit.identifier,
                "source": "API",
                "user_id": None,
            }
            for result in results
        ]
        if records:
            annotation_table: type[models.SpanAnnotation] | type[models.ProjectSessionAnnotation]
            if unit.evaluation_target == "SPAN":
                annotation_table = models.SpanAnnotation
                unique_by = ("name", "span_rowid", "identifier")
                on_conflict = OnConflict.DO_NOTHING
            else:
                annotation_table = models.ProjectSessionAnnotation
                unique_by = ("name", "project_session_id", "identifier")
                on_conflict = OnConflict.DO_UPDATE
            inserted_ids: Sequence[int] = ()

            async def _write_annotations(session: AsyncSession) -> None:
                nonlocal inserted_ids
                inserted_ids = (
                    await session.scalars(
                        insert_on_conflict(
                            *records,
                            table=annotation_table,
                            dialect=self._db.dialect,
                            unique_by=unique_by,
                            on_conflict=on_conflict,
                        ).returning(annotation_table.id)
                    )
                ).all()

            async with self._db_phase():
                if self._db.should_not_insert_or_update:
                    raise OnlineEvalStoragePaused
                await self._coordinator.publish(
                    work_unit_id=unit.work_unit_id,
                    claimed_by=unit.claimed_by,
                    write=_write_annotations,
                    coverage_watermark=(
                        _session_coverage_watermark(hydrated)
                        if unit.evaluation_target == "SESSION"
                        else None
                    ),
                )
            # Span duplicates return no id and need no cache invalidation. Session
            # replacements return their id because the annotation genuinely changed.
            if self._event_queue is not None and inserted_ids:
                if unit.evaluation_target == "SPAN":
                    self._event_queue.put(SpanAnnotationInsertEvent(tuple(inserted_ids)))
                else:
                    self._event_queue.put(ProjectSessionAnnotationInsertEvent(tuple(inserted_ids)))
        if not records:
            raise EvalExecutionError("evaluator returned no results")

    async def _persist_evaluator_traces(self, tracer: Tracer, project_evaluator_id: int) -> None:
        """Write the evaluator's trace, never failing the evaluation over it."""
        try:
            async with self._db_phase():
                await persist_evaluator_traces(
                    db=self._db,
                    tracer=tracer,
                    project_evaluator_id=project_evaluator_id,
                    event_queue=self._event_queue,
                )
        except Exception:
            logger.exception("Failed to record an evaluator trace")

    @asynccontextmanager
    async def _db_phase(self) -> AsyncIterator[None]:
        if self._db_semaphore is None:
            yield
            return
        async with self._db_semaphore:
            yield
