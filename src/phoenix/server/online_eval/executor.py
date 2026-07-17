"""Execution glue for claimed online-eval work units: criteria-first hydration,
target context assembly, evaluator invocation, and idempotent annotation writes.
Work-unit lifecycle transitions (complete/fail/expire) stay with the caller.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable, Literal, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import with_polymorphic
from strawberry.relay import GlobalID

from phoenix.config import (
    ENV_PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES,
    get_env_online_eval_max_sandbox_payload_bytes,
    get_env_online_eval_max_transcript_bytes,
)
from phoenix.db import models
from phoenix.db.helpers import token_counts_by_session
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OutputConfig,
    OutputConfigType,
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
from phoenix.server.online_eval.producer import resolve_criteria
from phoenix.server.online_eval.session_policy import session_criteria_is_schedulable
from phoenix.server.sandbox import SecretsContext, build_sandbox_backend
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.types import CanPutItem, DbSessionFactory

logger = logging.getLogger(__name__)

_EMPTY_INPUT_MAPPING = InputMapping(literal_mapping={}, path_mapping={})
_MAX_SESSION_EVAL_TURNS = 1_000

AnnotatorKind = Literal["LLM", "CODE"]
EvaluatorKind = Literal["LLM", "CODE", "BUILTIN"]


class EvalExecutionError(Exception):
    """The evaluator ran but produced no writable result."""


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
    session_id: str,
    turns: Sequence[dict[str, Any]],
    num_traces: int,
    duration_seconds: float,
    token_count_total: int,
    max_transcript_bytes: int,
) -> dict[str, Any]:
    """Build session context from the bounded set of root turns loaded by hydration.

    The transcript byte cap applies only to the rendered ``input`` string, and
    truncation-marker accounting covers only the loaded turns. Structured ``turns``
    remain intact for explicit mappings. Top-level ``metadata`` identifies the Phoenix
    session, while ``turns[i].metadata`` is span metadata; ``session_id`` is also exposed
    directly for zero-configuration mappings.
    """
    turn_blocks = [
        "User: "
        f"{'' if turn['input'] is None else turn['input']}\n"
        "Assistant: "
        f"{'' if turn['output'] is None else turn['output']}"
        for turn in turns
    ]
    transcript = "\n\n".join(turn_blocks)
    transcript_bytes = len(transcript.encode("utf-8"))
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
                    raise EvalExecutionError(
                        f"Session transcript is {transcript_bytes} bytes, exceeding the "
                        f"{max_transcript_bytes}-byte cap, and no complete turns fit after "
                        f"truncation. Raise {ENV_PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES} "
                        "to evaluate this session."
                    )
                retained = "\n\n".join(turn_blocks[omitted_turns:])
                transcript = f"{marker}\n\n{retained}"
                break

    first_input = turns[0]["input"] if turns else None
    last_output = turns[-1]["output"] if turns else None
    return {
        "input": transcript,
        "output": last_output,
        "last_output": last_output,
        "first_input": first_input,
        "turns": list(turns),
        "session_id": session_id,
        "metadata": {"session_id": session_id},
        "num_traces": num_traces,
        "duration_seconds": duration_seconds,
        "token_count_total": token_count_total,
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
    ) -> None:
        self._db = db
        self._decrypt = decrypt
        self._sandbox_session_manager = sandbox_session_manager
        self._event_queue = event_queue

    async def hydrate(self, unit: ClaimedWorkUnit) -> Optional[HydratedWorkUnit]:
        """Load and snapshot everything the eval needs, returning None when the
        unit is stale: the criteria row is gone or disabled, the referenced span
        is gone, or the fingerprint recomputed from current criteria/evaluator/
        version state no longer matches the one materialized on the unit. Stale
        units must be expired, never executed. The session closes before any
        LLM call happens; hydration failures that are not staleness raise and
        take the retryable failure path. Session hydration loads at most the
        ``_MAX_SESSION_EVAL_TURNS`` most recent root turns and restores chronological
        order before rendering; transcript truncation therefore accounts only for
        those loaded turns."""
        async with self._db() as session:
            criteria = await session.get(models.ProjectEvaluatorCriteria, unit.criteria_id)
            if criteria is None or not criteria.enabled:
                return None
            if unit.evaluation_target == "SESSION":
                if unit.generation != 0:
                    return None
                schedulable = await session.scalar(
                    select(models.ProjectEvaluatorCriteria.id).where(
                        models.ProjectEvaluatorCriteria.id == criteria.id,
                        session_criteria_is_schedulable(models.ProjectEvaluatorCriteria),
                    )
                )
                if schedulable is None:
                    return None
            elif unit.evaluation_target != "SPAN":
                return None
            polymorphic = with_polymorphic(
                models.Evaluator,
                [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
            )
            evaluator_orm = await session.scalar(
                select(polymorphic).where(polymorphic.id == criteria.evaluator_id)
            )
            if evaluator_orm is None:
                return None
            resolved = await resolve_criteria(session, criteria, evaluator_orm)
            if resolved is None or config_fingerprint(resolved) != unit.config_fingerprint:
                return None
            max_payload_bytes: int | None = None
            if unit.evaluation_target == "SPAN":
                span = await session.get(models.Span, unit.target_rowid)
                if span is None:
                    return None
                context = span_eval_context(span)
            else:
                project_session = await session.get(models.ProjectSession, unit.target_rowid)
                if project_session is None or project_session.project_id != criteria.project_id:
                    return None
                root_span_ids = (
                    select(
                        models.Span.trace_rowid.label("trace_rowid"),
                        func.min(models.Span.id).label("span_id"),
                    )
                    .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                    .where(
                        models.Trace.project_session_rowid == project_session.id,
                        models.Span.parent_id.is_(None),
                    )
                    .group_by(models.Span.trace_rowid)
                    .subquery()
                )
                most_recent_root_spans = (
                    select(
                        root_span_ids.c.span_id,
                        models.Trace.start_time.label("trace_start_time"),
                        models.Trace.id.label("trace_id"),
                    )
                    .join(models.Trace, root_span_ids.c.trace_rowid == models.Trace.id)
                    .order_by(
                        models.Trace.start_time.desc(),
                        models.Trace.id.desc(),
                        root_span_ids.c.span_id.desc(),
                    )
                    .limit(_MAX_SESSION_EVAL_TURNS)
                    .subquery()
                )
                root_spans = (
                    await session.scalars(
                        select(models.Span)
                        .join(
                            most_recent_root_spans,
                            models.Span.id == most_recent_root_spans.c.span_id,
                        )
                        .order_by(
                            most_recent_root_spans.c.trace_start_time.asc(),
                            most_recent_root_spans.c.trace_id.asc(),
                            most_recent_root_spans.c.span_id.asc(),
                        )
                    )
                ).all()
                turns = [
                    {
                        "input": span.input_value,
                        "output": span.output_value,
                        "metadata": span.metadata_,
                    }
                    for span in root_spans
                ]
                num_traces = (
                    await session.scalar(
                        select(func.count(models.Trace.id)).where(
                            models.Trace.project_session_rowid == project_session.id
                        )
                    )
                    or 0
                )
                token_counts = (
                    await session.execute(token_counts_by_session([project_session.id]))
                ).one_or_none()
                token_count_total = (
                    (token_counts.prompt or 0) + (token_counts.completion or 0)
                    if token_counts is not None
                    else 0
                )
                context = session_eval_context(
                    session_id=project_session.session_id,
                    turns=turns,
                    num_traces=num_traces,
                    duration_seconds=max(
                        0.0,
                        (project_session.end_time - project_session.start_time).total_seconds(),
                    ),
                    token_count_total=token_count_total,
                    max_transcript_bytes=get_env_online_eval_max_transcript_bytes(),
                )
                max_payload_bytes = get_env_online_eval_max_sandbox_payload_bytes()
            input_mapping = (
                InputMapping.model_validate(resolved.input_mapping)
                if resolved.input_mapping is not None
                else _EMPTY_INPUT_MAPPING
            )
            if isinstance(evaluator_orm, models.LLMEvaluator):
                return await self._hydrate_llm(
                    session,
                    evaluator_orm,
                    resolved.name,
                    resolved.version_ref,
                    input_mapping,
                    context,
                )
            if isinstance(evaluator_orm, models.CodeEvaluator):
                return await self._hydrate_code(
                    session,
                    evaluator_orm,
                    resolved.name,
                    resolved.version_ref,
                    input_mapping,
                    context,
                    max_payload_bytes=max_payload_bytes,
                )
            if isinstance(evaluator_orm, models.BuiltinEvaluator):
                return self._hydrate_builtin(evaluator_orm, resolved.name, input_mapping, context)
            return None

    async def _hydrate_llm(
        self,
        session: AsyncSession,
        evaluator_orm: models.LLMEvaluator,
        annotation_name: str,
        prompt_version_id: int,
        input_mapping: InputMapping,
        context: dict[str, Any],
    ) -> Optional[HydratedWorkUnit]:
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
        )
        return HydratedWorkUnit(
            annotation_name=annotation_name,
            annotator_kind="LLM",
            evaluator_kind="LLM",
            evaluator=evaluator,
            input_mapping=input_mapping,
            output_configs=evaluator_orm.output_configs,
            context=context,
        )

    async def _hydrate_code(
        self,
        session: AsyncSession,
        evaluator_orm: models.CodeEvaluator,
        annotation_name: str,
        code_version_id: int,
        input_mapping: InputMapping,
        context: dict[str, Any],
        *,
        max_payload_bytes: int | None = None,
    ) -> Optional[HydratedWorkUnit]:
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
        output_configs: list[OutputConfigType] = []
        for config in evaluator_orm.output_configs:
            if config.name is None:
                continue
            output_config = OutputConfig.model_validate(config.model_dump()).root
            if isinstance(
                output_config,
                (CategoricalOutputConfig, ContinuousOutputConfig, FreeformOutputConfig),
            ):
                output_configs.append(output_config)
        evaluator = CodeEvaluatorRunner(
            name=evaluator_orm.name.root,
            description=evaluator_orm.description,
            source_code=code_version.source_code,
            stored_output_configs=output_configs,
            sandbox_backend=backend,
            language=evaluator_orm.language,
            sandbox_session_manager=self._sandbox_session_manager,
            timeout=sandbox_config.timeout,
            evaluator_version_id=str(GlobalID("CodeEvaluatorVersion", str(code_version.id))),
            session_key=(
                f"online-eval:{evaluator_orm.id}:{self._sandbox_session_manager.replica_id}"
            ),
            max_payload_bytes=max_payload_bytes,
            payload_limit_remediation=(
                "Reduce the mapped session inputs or raise the limit with "
                "PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES."
            ),
        )
        return HydratedWorkUnit(
            annotation_name=annotation_name,
            annotator_kind="CODE",
            evaluator_kind="CODE",
            evaluator=evaluator,
            input_mapping=input_mapping,
            output_configs=output_configs,
            context=context,
        )

    def _hydrate_builtin(
        self,
        evaluator_orm: models.BuiltinEvaluator,
        annotation_name: str,
        input_mapping: InputMapping,
        context: dict[str, Any],
    ) -> HydratedWorkUnit:
        evaluator_cls = get_builtin_evaluator_by_key(evaluator_orm.key)
        if evaluator_cls is None:
            raise ValueError(f"Built-in evaluator key {evaluator_orm.key!r} is not in the registry")
        return HydratedWorkUnit(
            annotation_name=annotation_name,
            annotator_kind="CODE",
            evaluator_kind="BUILTIN",
            evaluator=evaluator_cls(),
            input_mapping=input_mapping,
            output_configs=evaluator_orm.output_configs,
            context=context,
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
            expected_names = {
                (
                    f"{hydrated.annotation_name}.{config.name}"
                    if multi_output
                    else hydrated.annotation_name
                )
                for config in hydrated.output_configs
            }
            returned_names = {result["name"] for result in results}
            if returned_names != expected_names:
                missing = sorted(expected_names - returned_names)
                unexpected = sorted(returned_names - expected_names)
                raise EvalExecutionError(
                    "evaluator returned an incomplete result set: "
                    f"missing={missing}, unexpected={unexpected}"
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
                "metadata_": result["metadata"],
                "annotator_kind": hydrated.annotator_kind,
                "identifier": unit.identifier,
                "source": "API",
                "user_id": None,
            }
            for result in results
        ]
        if records:
            async with self._db() as session:
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
