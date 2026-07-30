"""Execution glue for claimed online-eval work units: criteria-first hydration,
target context assembly, evaluator invocation, and idempotent annotation writes.
Session publication completes work atomically; other lifecycle transitions stay
with the caller.
"""

from __future__ import annotations

import asyncio
import logging
from collections import Counter
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncIterator, Callable, Literal, Optional, Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import with_polymorphic
from strawberry.relay import GlobalID

from phoenix.config import (
    ENV_PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES,
    get_env_online_eval_max_llm_message_bytes,
    get_env_online_eval_max_sandbox_payload_bytes,
    get_env_online_eval_max_transcript_bytes,
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
    LLMEvaluator,
    get_builtin_evaluator_by_key,
)
from phoenix.server.api.helpers.playground_clients import get_playground_client
from phoenix.server.dml_event import (
    DmlEvent,
    ProjectSessionAnnotationInsertEvent,
    SpanAnnotationInsertEvent,
)
from phoenix.server.online_eval.coordinator import ClaimedWorkUnit
from phoenix.server.online_eval.derivation import config_fingerprint
from phoenix.server.online_eval.producer import resolve_criteria_bulk
from phoenix.server.online_eval.session_policy import session_criteria_is_schedulable
from phoenix.server.sandbox import SecretsContext, build_sandbox_backend
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.types import CanPutItem, DbSessionFactory

logger = logging.getLogger(__name__)

_EMPTY_INPUT_MAPPING = InputMapping(literal_mapping={}, path_mapping={})
_MAX_SESSION_EVAL_TURNS = 1_000
_TRANSCRIPT_POLICY_METADATA_KEY = "phoenix.online_eval.transcript_policy"
_TRANSCRIPT_POLICY_VERSION = "1"
_DEFAULT_EXECUTION_DEADLINE_SECONDS = 600.0

AnnotatorKind = Literal["LLM", "CODE"]
EvaluatorKind = Literal["LLM", "CODE", "BUILTIN"]


class EvalExecutionError(Exception):
    """The evaluator ran but produced no writable result."""


class EvaluatorResultValidationError(EvalExecutionError):
    """The evaluator returned a result that violates its output contract."""

    online_eval_error_code = "EVALUATOR_RESULT_INVALID"
    online_eval_count_attempt = True


class PublicationClaimLostError(EvalExecutionError):
    """The work unit is no longer eligible for publication."""

    online_eval_terminal_code = "PUBLICATION_CLAIM_LOST"


class TranscriptTooLargeError(Exception):
    """No complete session turn fits within the transcript limit."""


class OnlineEvalStoragePaused(Exception):
    """Publication is paused while database insertions and updates are blocked."""


class HydrationFailureReason(str, Enum):
    CRITERIA_MISSING = "CRITERIA_MISSING"
    CRITERIA_DISABLED = "CRITERIA_DISABLED"
    CRITERIA_NOT_SCHEDULABLE = "CRITERIA_NOT_SCHEDULABLE"
    EVALUATOR_MISSING = "EVALUATOR_MISSING"
    EVALUATOR_VERSION_MISSING = "EVALUATOR_VERSION_MISSING"
    SANDBOX_RUNTIME_UNAVAILABLE = "SANDBOX_RUNTIME_UNAVAILABLE"
    CONFIG_FINGERPRINT_MISMATCH = "CONFIG_FINGERPRINT_MISMATCH"
    SPAN_MISSING = "SPAN_MISSING"
    SESSION_MISSING = "SESSION_MISSING"
    SESSION_PROJECT_MISMATCH = "SESSION_PROJECT_MISMATCH"
    SESSION_CONTENT_INCOMPLETE = "SESSION_CONTENT_INCOMPLETE"
    UNSUPPORTED_TARGET = "UNSUPPORTED_TARGET"
    NO_ROOT_TURNS = "NO_ROOT_TURNS"
    TRANSCRIPT_TOO_LARGE = "TRANSCRIPT_TOO_LARGE"


@dataclass(frozen=True)
class HydrationFailure:
    reason: HydrationFailureReason
    detail: str = ""


@dataclass(frozen=True)
class HydratedWorkUnit:
    """Everything one eval needs, copied out of the mutable criteria/evaluator
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


ConfigurationSnapshotOutcome = HydratedConfigurationSnapshot | HydrationFailure | Exception


def span_eval_context(span: models.Span) -> dict[str, Any]:
    """Span context; ``metadata.attributes`` roots attribute ``path_mapping`` expressions."""
    return {
        "input": span.input_value,
        "output": span.output_value,
        "metadata": {
            "attributes": span.attributes,
            "name": span.name,
            "span_kind": span.span_kind,
            "status_code": span.status_code,
            "status_message": span.status_message,
        },
    }


def session_eval_context(
    *,
    turns: Sequence[dict[str, Any]],
    max_transcript_bytes: int,
    total_eligible_root_count: Optional[int] = None,
) -> dict[str, Any]:
    """Build the transcript, turn metadata, and applied transcript policy."""
    total_root_count = (
        len(turns) if total_eligible_root_count is None else total_eligible_root_count
    )
    turn_cap_omitted_count = max(0, total_root_count - len(turns))
    turn_blocks = [
        "User: "
        f"{'' if turn['input'] is None else turn['input']}\n"
        "Assistant: "
        f"{'' if turn['output'] is None else turn['output']}"
        for turn in turns
    ]
    transcript = "\n\n".join(turn_blocks)
    transcript_bytes = len(transcript.encode("utf-8"))
    byte_cap_omitted_count = 0
    if transcript_bytes > max_transcript_bytes:
        block_sizes = [len(block.encode("utf-8")) for block in turn_blocks]
        suffix_sizes = [0] * (len(turn_blocks) + 1)
        for index in range(len(turn_blocks) - 1, -1, -1):
            separator_size = 2 if index + 1 < len(turn_blocks) else 0
            suffix_sizes[index] = block_sizes[index] + separator_size + suffix_sizes[index + 1]
        for omitted_turns in range(1, len(turn_blocks) + 1):
            marker = f"[transcript truncated: first {omitted_turns} turns omitted]"
            retained_size = suffix_sizes[omitted_turns]
            candidate_size = len(marker.encode("utf-8"))
            if retained_size:
                candidate_size += 2 + retained_size
            if candidate_size <= max_transcript_bytes:
                if omitted_turns == len(turn_blocks):
                    raise TranscriptTooLargeError(
                        f"Session transcript is {transcript_bytes} bytes, exceeding the "
                        f"{max_transcript_bytes}-byte cap, and no complete turns fit after "
                        f"truncation. Raise {ENV_PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES} "
                        "to evaluate this session."
                    )
                retained = "\n\n".join(turn_blocks[omitted_turns:])
                transcript = f"{marker}\n\n{retained}"
                byte_cap_omitted_count = omitted_turns
                break

    retained_turns = list(turns[byte_cap_omitted_count:])
    first_loaded = turns[0].get("event_time") if turns else None
    last_loaded = turns[-1].get("event_time") if turns else None
    first_retained = retained_turns[0].get("event_time") if retained_turns else None
    last_retained = retained_turns[-1].get("event_time") if retained_turns else None
    output = turns[-1]["output"] if turns and turns[-1]["output"] is not None else ""
    policy = {
        "version": _TRANSCRIPT_POLICY_VERSION,
        "ordering": "root_span_start_time_then_span_id",
        "max_turns": _MAX_SESSION_EVAL_TURNS,
        "max_bytes": max_transcript_bytes,
        "total_eligible_root_count": total_root_count,
        "loaded_turn_count": len(turns),
        "retained_turn_count": len(retained_turns),
        "turn_cap_omitted_count": turn_cap_omitted_count,
        "byte_cap_omitted_count": byte_cap_omitted_count,
        "first_loaded_event_time": first_loaded,
        "last_loaded_event_time": last_loaded,
        "first_retained_event_time": first_retained,
        "last_retained_event_time": last_retained,
        "structured_turns_mapped": False,
    }
    return {
        "input": transcript,
        "output": output,
        "metadata": {
            "turns": list(turns),
            _TRANSCRIPT_POLICY_METADATA_KEY: policy,
        },
    }


class OnlineEvalExecutor:
    """Hydrates and executes claimed work units against the eval runtime."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        decrypt: Callable[[bytes], bytes],
        sandbox_session_manager: Optional[SandboxSessionManager] = None,
        event_queue: Optional[CanPutItem[DmlEvent]] = None,
        execution_deadline_seconds: float = _DEFAULT_EXECUTION_DEADLINE_SECONDS,
        db_semaphore: Optional[asyncio.Semaphore] = None,
    ) -> None:
        self._db = db
        self._decrypt = decrypt
        self._sandbox_session_manager = sandbox_session_manager
        self._event_queue = event_queue
        self._execution_deadline_seconds = execution_deadline_seconds
        self._db_semaphore = db_semaphore

    async def hydrate(self, unit: ClaimedWorkUnit) -> HydrationOutcome:
        configuration = (await self.hydrate_configuration_snapshots([unit]))[0]
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
            return [error for _ in units]

    async def _hydrate_configuration_snapshots(
        self,
        session: AsyncSession,
        units: Sequence[ClaimedWorkUnit],
    ) -> list[ConfigurationSnapshotOutcome]:
        criteria_ids = {unit.criteria_id for unit in units}
        polymorphic = with_polymorphic(
            models.Evaluator,
            [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
        )
        rows = (
            await session.execute(
                select(
                    models.ProjectEvaluatorCriteria,
                    polymorphic,
                    session_criteria_is_schedulable(models.ProjectEvaluatorCriteria).label(
                        "session_schedulable"
                    ),
                )
                .outerjoin(
                    polymorphic,
                    models.ProjectEvaluatorCriteria.evaluator_id == polymorphic.id,
                )
                .where(models.ProjectEvaluatorCriteria.id.in_(criteria_ids))
            )
        ).all()
        rows_by_criteria_id = {
            criteria.id: (criteria, evaluator, bool(session_schedulable))
            for criteria, evaluator, session_schedulable in rows
        }

        preliminary: list[Optional[HydrationFailure]] = []
        criteria_evaluators: dict[
            int, tuple[models.ProjectEvaluatorCriteria, models.Evaluator]
        ] = {}
        for unit in units:
            row = rows_by_criteria_id.get(unit.criteria_id)
            failure: Optional[HydrationFailure] = None
            if row is None:
                failure = HydrationFailure(HydrationFailureReason.CRITERIA_MISSING)
            else:
                criteria, evaluator, session_schedulable = row
                if not criteria.enabled:
                    failure = HydrationFailure(HydrationFailureReason.CRITERIA_DISABLED)
                elif unit.evaluation_target == "SESSION" and not session_schedulable:
                    failure = HydrationFailure(HydrationFailureReason.CRITERIA_NOT_SCHEDULABLE)
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
                    criteria_evaluators.setdefault(criteria.id, (criteria, evaluator))
            preliminary.append(failure)

        criteria_evaluator_rows = list(criteria_evaluators.values())
        resolved_rows = await resolve_criteria_bulk(session, criteria_evaluator_rows)
        resolved_by_criteria_id = {
            criteria.id: resolved
            for (criteria, _), resolved in zip(
                criteria_evaluator_rows,
                resolved_rows,
                strict=True,
            )
        }
        unresolved_failures: dict[int, HydrationFailure] = {}
        for criteria_id, (_, evaluator) in criteria_evaluators.items():
            if resolved_by_criteria_id[criteria_id] is not None:
                continue
            unresolved_failures[criteria_id] = await self._unresolved_configuration_failure(
                session,
                evaluator,
            )

        matching_criteria_ids: set[int] = set()
        outcomes: list[Optional[ConfigurationSnapshotOutcome]] = []
        for unit, failure in zip(units, preliminary, strict=True):
            if failure is not None:
                outcomes.append(failure)
                continue
            resolved = resolved_by_criteria_id[unit.criteria_id]
            if resolved is None:
                outcomes.append(unresolved_failures[unit.criteria_id])
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

        contexts: list[Optional[dict[str, Any]]] = [None for _ in units]
        input_mappings: list[Optional[InputMapping]] = [None for _ in units]
        for index, (unit, outcome) in enumerate(zip(units, outcomes, strict=True)):
            if outcome is not None:
                continue
            criteria, _ = criteria_evaluators[unit.criteria_id]
            try:
                hydrated_context = await self._hydrate_target_context(
                    session,
                    unit,
                    project_id=criteria.project_id,
                )
            except Exception as error:
                outcomes[index] = error
                continue
            if isinstance(hydrated_context, HydrationFailure):
                outcomes[index] = hydrated_context
                continue
            resolved = resolved_by_criteria_id[unit.criteria_id]
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
            if unit.evaluation_target == "SESSION":
                policy = hydrated_context["metadata"][_TRANSCRIPT_POLICY_METADATA_KEY]
                policy["structured_turns_mapped"] = any(
                    path_expression.removeprefix("$.").startswith("metadata.turns")
                    for path_expression in (resolved_input_mapping.path_mapping or {}).values()
                )
            contexts[index] = hydrated_context
            input_mappings[index] = resolved_input_mapping
            matching_criteria_ids.add(unit.criteria_id)

        evaluator_snapshots: dict[
            int, _HydratedEvaluatorSnapshot | HydrationFailure | Exception
        ] = {}
        for criteria_id in matching_criteria_ids:
            _, evaluator = criteria_evaluators[criteria_id]
            if evaluator.id in evaluator_snapshots:
                continue
            resolved = resolved_by_criteria_id[criteria_id]
            assert resolved is not None
            try:
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
            criteria, evaluator = criteria_evaluators[unit.criteria_id]
            evaluator_snapshot_outcome = evaluator_snapshots[evaluator.id]
            if isinstance(evaluator_snapshot_outcome, (HydrationFailure, Exception)):
                outcomes[index] = evaluator_snapshot_outcome
                continue
            resolved = resolved_by_criteria_id[unit.criteria_id]
            assert resolved is not None
            snapshot_context = contexts[index]
            if snapshot_context is None:
                outcomes[index] = RuntimeError("Target context hydration did not produce a result")
                continue
            snapshot_input_mapping = input_mappings[index]
            if snapshot_input_mapping is None:
                outcomes[index] = RuntimeError("Input mapping hydration did not produce a result")
                continue
            annotation_metadata: dict[str, Any] = {}
            if unit.evaluation_target == "SESSION":
                policy = snapshot_context["metadata"][_TRANSCRIPT_POLICY_METADATA_KEY]
                evaluator_input_schema = getattr(
                    evaluator_snapshot_outcome.evaluator,
                    "input_schema",
                    {},
                )
                policy["structured_turns_mapped"] = bool(
                    policy["structured_turns_mapped"]
                    or "metadata" in evaluator_input_schema.get("properties", {})
                )
                annotation_metadata = {_TRANSCRIPT_POLICY_METADATA_KEY: dict(policy)}
            outcomes[index] = HydratedConfigurationSnapshot(
                project_id=criteria.project_id,
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
    ) -> dict[str, Any] | HydrationFailure:
        if unit.evaluation_target == "SPAN":
            span = await session.get(models.Span, unit.target_rowid)
            if span is None:
                return HydrationFailure(HydrationFailureReason.SPAN_MISSING)
            return span_eval_context(span)
        project_session = await session.get(models.ProjectSession, unit.target_rowid)
        if project_session is None:
            return HydrationFailure(HydrationFailureReason.SESSION_MISSING)
        if project_session.project_id != project_id:
            return HydrationFailure(HydrationFailureReason.SESSION_PROJECT_MISMATCH)
        if not project_session.content_complete:
            return HydrationFailure(HydrationFailureReason.SESSION_CONTENT_INCOMPLETE)
        root_filters = (
            models.Trace.project_session_rowid == project_session.id,
            models.Trace.project_rowid == project_id,
            models.Span.parent_id.is_(None),
        )
        total_eligible_root_count = (
            await session.scalar(
                select(func.count())
                .select_from(models.Span)
                .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                .where(*root_filters)
            )
            or 0
        )
        if total_eligible_root_count == 0:
            return HydrationFailure(HydrationFailureReason.NO_ROOT_TURNS)
        root_rows = (
            await session.execute(
                select(
                    models.Span.input_value,
                    models.Span.output_value,
                    models.Span.metadata_,
                    models.Span.start_time.label("event_time"),
                    models.Span.span_id,
                )
                .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                .where(*root_filters)
                .order_by(
                    models.Span.start_time.desc(),
                    models.Span.span_id.desc(),
                )
                .limit(_MAX_SESSION_EVAL_TURNS)
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
        try:
            return session_eval_context(
                turns=turns,
                max_transcript_bytes=get_env_online_eval_max_transcript_bytes(),
                total_eligible_root_count=total_eligible_root_count,
            )
        except TranscriptTooLargeError as error:
            return HydrationFailure(
                HydrationFailureReason.TRANSCRIPT_TOO_LARGE,
                str(error),
            )

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
            if not isinstance(version_ref, int):
                return None
            return await self._hydrate_llm(session, evaluator_orm, version_ref)
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
            payload_limit_remediation=(
                "Reduce the dominant evaluator source or mapped inputs, or raise the limit with "
                "PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES."
            ),
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
        """Run the eval and write successful results as target annotations under
        the unit's identifier. DO_NOTHING makes the write first-write-wins, so
        re-runs of the same unit are no-ops. Raises before writing unless the
        evaluator returns one complete, error-free result set. No DB session is
        open while the evaluator runs."""
        results = await hydrated.evaluator.evaluate(
            context=hydrated.context,
            input_mapping=hydrated.input_mapping,
            name=hydrated.annotation_name,
            output_configs=hydrated.output_configs,
        )
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
                },
                "annotator_kind": hydrated.annotator_kind,
                "identifier": unit.identifier,
                "source": "API",
                "user_id": None,
            }
            for result in results
        ]
        if records:
            async with self._db_phase():
                if self._db.should_not_insert_or_update:
                    raise OnlineEvalStoragePaused
                async with self._db() as session:
                    if unit.evaluation_target == "SPAN":
                        owned_work_unit_id = await session.scalar(
                            select(models.EvalWorkUnit.id)
                            .join(
                                models.ProjectEvaluatorCriteria,
                                models.ProjectEvaluatorCriteria.id
                                == models.EvalWorkUnit.criteria_id,
                            )
                            .where(
                                models.EvalWorkUnit.id == unit.work_unit_id,
                                models.EvalWorkUnit.status == "RUNNING",
                                models.EvalWorkUnit.claimed_by == unit.claimed_by,
                                models.ProjectEvaluatorCriteria.enabled,
                            )
                        )
                        publication_fence_succeeded = owned_work_unit_id is not None
                    else:
                        transition_result = await session.execute(
                            update(models.EvalSessionWorkUnit)
                            .where(
                                models.EvalSessionWorkUnit.id == unit.work_unit_id,
                                models.EvalSessionWorkUnit.status == "RUNNING",
                                models.EvalSessionWorkUnit.claimed_by == unit.claimed_by,
                                models.EvalSessionWorkUnit.criteria_id.in_(
                                    select(models.ProjectEvaluatorCriteria.id).where(
                                        models.ProjectEvaluatorCriteria.enabled
                                    )
                                ),
                            )
                            .values(status="DONE")
                        )
                        publication_fence_succeeded = bool(
                            transition_result.rowcount == 1  # type: ignore[attr-defined]
                        )
                    if not publication_fence_succeeded:
                        raise PublicationClaimLostError(
                            f"work unit {unit.work_unit_id} is no longer owned and live"
                        )
                    if unit.evaluation_target == "SPAN":
                        inserted_ids = (
                            await session.scalars(
                                insert_on_conflict(
                                    *records,
                                    table=models.SpanAnnotation,
                                    dialect=self._db.dialect,
                                    unique_by=("name", "span_rowid", "identifier"),
                                    on_conflict=OnConflict.DO_NOTHING,
                                ).returning(models.SpanAnnotation.id)
                            )
                        ).all()
                    else:
                        inserted_ids = (
                            await session.scalars(
                                insert_on_conflict(
                                    *records,
                                    table=models.ProjectSessionAnnotation,
                                    dialect=self._db.dialect,
                                    unique_by=("name", "project_session_id", "identifier"),
                                    on_conflict=OnConflict.DO_NOTHING,
                                ).returning(models.ProjectSessionAnnotation.id)
                            )
                        ).all()
            # DO_NOTHING returns only rows actually inserted, so a deduped
            # re-run emits no event and dataloader caches aren't re-invalidated.
            if self._event_queue is not None and inserted_ids:
                if unit.evaluation_target == "SPAN":
                    self._event_queue.put(SpanAnnotationInsertEvent(tuple(inserted_ids)))
                else:
                    self._event_queue.put(ProjectSessionAnnotationInsertEvent(tuple(inserted_ids)))
        if not records:
            raise EvalExecutionError("evaluator returned no results")

    @asynccontextmanager
    async def _db_phase(self) -> AsyncIterator[None]:
        if self._db_semaphore is None:
            yield
            return
        async with self._db_semaphore:
            yield
