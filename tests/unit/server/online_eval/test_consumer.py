import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from queue import SimpleQueue
from secrets import token_hex
from typing import Any, AsyncIterator, Optional, Sequence, cast
from unittest.mock import Mock

import httpx
import pytest
from sqlalchemy import select, text, update
from sqlalchemy.orm import with_polymorphic

from phoenix.db import models
from phoenix.db.eval_work import SESSION_CONTENT_INCOMPLETE_ERROR
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
    OutputConfigType,
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
    PromptTemplateType,
    PromptToolChoiceOneOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
)
from phoenix.server.api.evaluators import ContainsEvaluator, SandboxPayloadTooLargeError
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    FunctionCallChunk,
    ToolCallChunk,
)
from phoenix.server.dml_event import (
    DmlEvent,
    ProjectSessionAnnotationInsertEvent,
    SpanAnnotationInsertEvent,
)
from phoenix.server.encryption import EncryptionService
from phoenix.server.online_eval import consumer as consumer_module
from phoenix.server.online_eval import executor as executor_module
from phoenix.server.online_eval.consumer import (
    OnlineEvalConsumer,
)
from phoenix.server.online_eval.coordinator import (
    LEASE_TTL_SECONDS,
    ClaimedWorkUnit,
    PublicationClaimLostError,
)
from phoenix.server.online_eval.criteria_resolution import (
    resolve_criteria,
    resolve_criteria_bulk,
)
from phoenix.server.online_eval.db_coordinator import DbEvalWorkCoordinator
from phoenix.server.online_eval.derivation import (
    MAX_ATTEMPTS,
    annotation_identifier,
    config_fingerprint,
)
from phoenix.server.online_eval.executor import (
    EvalExecutionError,
    EvaluatorResultValidationError,
    HydratedWorkUnit,
    HydrationFailure,
    HydrationFailureReason,
    OnlineEvalExecutor,
    TranscriptTooLargeError,
    session_eval_context,
    span_eval_context,
)
from phoenix.server.online_eval.failure_policy import is_transient_error
from phoenix.server.online_eval.session_policy import (
    MAX_SESSION_EVAL_TURNS,
    SessionTranscriptPolicy,
)
from phoenix.server.online_eval.session_sweeper import SessionEvalSweeper
from phoenix.server.sandbox.types import ExecutionResult
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace


class _StubLLMClient:
    """Streams a single canned tool call, or raises to simulate a provider error."""

    def __init__(
        self,
        tool_name: str = "quality",
        arguments: str = '{"label": "good", "explanation": "looks good"}',
        error: Optional[Exception] = None,
    ) -> None:
        self._tool_name = tool_name
        self._arguments = arguments
        self._error = error
        self.requests: list[dict[str, Any]] = []

    async def chat_completion_create(self, **kwargs: Any) -> AsyncIterator[Any]:
        self.requests.append(kwargs)
        if self._error is not None:
            raise self._error
        yield ToolCallChunk(
            id="call-1",
            function=FunctionCallChunk(name=self._tool_name, arguments=self._arguments),
        )

    def is_rate_limit_error(self, error: Exception) -> bool:
        return bool(getattr(error, "provider_rate_limit", False))

    def is_transient_error(self, error: Exception) -> bool:
        return bool(getattr(error, "provider_transient", False))


def _patch_playground_client(monkeypatch: pytest.MonkeyPatch, client: _StubLLMClient) -> None:
    async def _get_client(**_: Any) -> _StubLLMClient:
        return client

    monkeypatch.setattr("phoenix.server.online_eval.executor.get_playground_client", _get_client)


class _StubSandboxBackend:
    secret_values: tuple[str, ...] = ()
    # Duck-typed, so SandboxBackend's defaults must be mirrored.
    provider: str = ""


class _StubSandboxSession:
    def __init__(self) -> None:
        self.executed_code: list[str] = []

    async def execute(self, code: str, *, timeout: Optional[int] = None) -> ExecutionResult:
        self.executed_code.append(code)
        return ExecutionResult(
            stdout="===PHOENIX_RESULT_BEGIN===\n0.75\n===PHOENIX_RESULT_END===\n",
            stderr="",
        )


class _StubSandboxSessionManager:
    replica_id = "test-replica"

    def __init__(self) -> None:
        self.session = _StubSandboxSession()
        self.session_keys: list[str] = []

    @asynccontextmanager
    async def acquire(self, _backend: Any, session_key: str) -> AsyncIterator[_StubSandboxSession]:
        self.session_keys.append(session_key)
        yield self.session


class _StubEvaluator:
    def __init__(self, results: list[dict[str, Any]]) -> None:
        self._results = results

    async def evaluate(self, **_: Any) -> list[dict[str, Any]]:
        return self._results


def _output_config(name: str) -> CategoricalOutputConfig:
    return CategoricalOutputConfig(
        type="CATEGORICAL",
        name=name,
        optimization_direction=OptimizationDirection.MAXIMIZE,
        description=None,
        values=[
            CategoricalAnnotationValue(label="good", score=1.0),
            CategoricalAnnotationValue(label="bad", score=0.0),
        ],
    )


def _evaluation_result(
    name: str,
    *,
    error: Optional[str] = None,
    error_exc: Optional[Exception] = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "name": name,
        "label": None if error else "good",
        "score": None if error else 1.0,
        "explanation": None,
        "metadata": {},
        "error": error,
    }
    if error_exc is not None:
        result["error_exc"] = error_exc
    return result


def _hydrated_stub(
    *,
    results: list[dict[str, Any]],
    evaluator_kind: str,
    output_configs: Sequence[OutputConfigType],
    annotation_name: str = "criterion",
    annotation_metadata: Optional[dict[str, Any]] = None,
) -> HydratedWorkUnit:
    return HydratedWorkUnit(
        annotation_name=annotation_name,
        annotator_kind="LLM" if evaluator_kind == "LLM" else "CODE",
        evaluator_kind=cast(Any, evaluator_kind),
        evaluator=cast(Any, _StubEvaluator(results)),
        input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        output_configs=output_configs,
        context={},
        annotation_metadata=annotation_metadata or {},
    )


def _claimed_unit(target_rowid: int, *, work_unit_id: int = 1) -> ClaimedWorkUnit:
    now = datetime.now(timezone.utc)
    return ClaimedWorkUnit(
        work_unit_id=work_unit_id,
        evaluation_target="SPAN",
        target_rowid=target_rowid,
        evaluator_id=1,
        criteria_id=1,
        config_fingerprint="fingerprint",
        identifier="online:fingerprint",
        attempts=0,
        claimed_by="consumer",
        lease_expires_at=now + timedelta(seconds=LEASE_TTL_SECONDS),
    )


def _claimed_session_unit(
    project_session_rowid: int,
    *,
    identifier: str,
    work_unit_id: int = 1,
) -> ClaimedWorkUnit:
    now = datetime.now(timezone.utc)
    return ClaimedWorkUnit(
        work_unit_id=work_unit_id,
        evaluation_target="SESSION",
        target_rowid=project_session_rowid,
        evaluator_id=1,
        criteria_id=1,
        config_fingerprint="fingerprint",
        identifier=identifier,
        attempts=0,
        claimed_by="consumer",
        lease_expires_at=now + timedelta(seconds=LEASE_TTL_SECONDS),
    )


async def _claim_materialized_unit(
    db: DbSessionFactory,
    *,
    project_id: int,
    span_rowid: int,
) -> ClaimedWorkUnit:
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project_id)
    await _materialize_unit(db, span_rowid, evaluator_id, criteria_id)
    coordinator = DbEvalWorkCoordinator(db)
    (unit,) = await coordinator.claim(claimed_by="consumer", limit=1)
    return unit


async def _seed_llm_criteria(
    db: DbSessionFactory,
    project_id: int,
    *,
    template_content: str = "Input: {{input}}\n\nOutput: {{output}}\n\nGood?",
    criteria_input_mapping: Optional[InputMapping] = None,
    evaluation_target: models.EvaluationTarget = "SPAN",
    custom_provider: bool = False,
) -> tuple[int, int]:
    """Create an LLM evaluator (prompt + version + tools) and an enabled criteria
    row, returning (evaluator_id, criteria_id)."""
    async with db() as session:
        custom_provider_id: Optional[int] = None
        if custom_provider:
            provider = models.GenerativeModelCustomProvider(
                name=f"provider-{token_hex(4)}",
                provider="openai",
                sdk="OPENAI",
                config=EncryptionService().encrypt(b'{"base_url": "https://vendor.example"}'),
            )
            session.add(provider)
            await session.flush()
            custom_provider_id = provider.id
        prompt = models.Prompt(
            name=Identifier(root=f"prompt-{token_hex(4)}"),
            description=None,
            prompt_versions=[
                models.PromptVersion(
                    template_type=PromptTemplateType.CHAT,
                    template_format=PromptTemplateFormat.MUSTACHE,
                    template=PromptChatTemplate(
                        type="chat",
                        messages=[
                            PromptMessage(
                                role="user",
                                content=template_content,
                            ),
                        ],
                    ),
                    invocation_parameters=PromptOpenAIInvocationParameters(
                        type="openai", openai=PromptOpenAIInvocationParametersContent()
                    ),
                    tools=PromptTools(
                        type="tools",
                        tools=[
                            PromptToolFunction(
                                type="function",
                                function=PromptToolFunctionDefinition(
                                    name="quality",
                                    description="rates output quality",
                                    parameters={
                                        "type": "object",
                                        "properties": {
                                            "label": {
                                                "type": "string",
                                                "enum": ["good", "bad"],
                                            },
                                        },
                                        "required": ["label"],
                                    },
                                ),
                            )
                        ],
                        tool_choice=PromptToolChoiceOneOrMore(type="one_or_more"),
                    ),
                    response_format=None,
                    model_provider=ModelProvider.OPENAI,
                    model_name="gpt-4",
                    metadata_={},
                    custom_provider_id=custom_provider_id,
                )
            ],
        )
        evaluator = models.LLMEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            description=None,
            kind="LLM",
            output_configs=[
                CategoricalOutputConfig(
                    type="CATEGORICAL",
                    name="quality",
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                    description=None,
                    values=[
                        CategoricalAnnotationValue(label="good", score=1.0),
                        CategoricalAnnotationValue(label="bad", score=0.0),
                    ],
                )
            ],
            prompt=prompt,
        )
        session.add(evaluator)
        await session.flush()
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project_id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target=evaluation_target,
            input_mapping=criteria_input_mapping,
        )
        session.add(criteria)
        await session.flush()
        return evaluator.id, criteria.id


async def _seed_code_criteria(
    db: DbSessionFactory,
    project_id: int,
    *,
    criteria_input_mapping: InputMapping,
    evaluation_target: models.EvaluationTarget = "SPAN",
) -> tuple[int, int]:
    async with db() as session:
        language = await session.get(models.Language, "PYTHON")
        if language is None:
            session.add(models.Language(name="PYTHON"))
        provider = await session.get(models.SandboxProvider, "WASM")
        if provider is None:
            session.add(
                models.SandboxProvider(
                    backend_type="WASM",
                    enabled=True,
                    config={},
                )
            )
        await session.flush()
        sandbox_config = models.SandboxConfig(
            backend_type="WASM",
            language="PYTHON",
            name=Identifier(root=f"sandbox-{token_hex(4)}"),
            description=None,
            config={},
            timeout=30,
        )
        session.add(sandbox_config)
        await session.flush()
        evaluator = models.CodeEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            description=None,
            kind="CODE",
            language="PYTHON",
            sandbox_config_id=sandbox_config.id,
            input_mapping=InputMapping(
                literal_mapping={
                    "output": "evaluator default",
                    "metadata": "evaluator default",
                },
                path_mapping={},
            ),
            output_configs=[
                ContinuousOutputConfig(
                    type="CONTINUOUS",
                    name="score",
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                    description=None,
                    lower_bound=0.0,
                    upper_bound=1.0,
                )
            ],
            versions=[
                models.CodeEvaluatorVersion(
                    source_code="def evaluate(output, metadata): return 0.75"
                )
            ],
        )
        session.add(evaluator)
        await session.flush()
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project_id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target=evaluation_target,
            input_mapping=criteria_input_mapping,
        )
        session.add(criteria)
        await session.flush()
        return evaluator.id, criteria.id


async def _seed_builtin_criteria(
    db: DbSessionFactory,
    project_id: int,
    *,
    evaluation_target: models.EvaluationTarget = "SPAN",
) -> tuple[int, int]:
    async with db() as session:
        evaluator = await session.scalar(
            select(models.BuiltinEvaluator).where(models.BuiltinEvaluator.key == "contains")
        )
        if evaluator is None:
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root="contains"),
                kind="BUILTIN",
                key="contains",
                input_schema={},
                output_configs=[],
            )
            session.add(evaluator)
            await session.flush()
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project_id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target=evaluation_target,
        )
        session.add(criteria)
        await session.flush()
        return evaluator.id, criteria.id


async def _materialize_unit(
    db: DbSessionFactory, span_rowid: int, evaluator_id: int, criteria_id: int
) -> tuple[int, str]:
    """Materialize one PENDING work unit exactly as the producer would, returning
    (work_unit_id, config_fingerprint)."""
    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        polymorphic = with_polymorphic(
            models.Evaluator,
            [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
        )
        evaluator = await session.scalar(select(polymorphic).where(polymorphic.id == evaluator_id))
        assert evaluator is not None
        resolved = await resolve_criteria(session, criteria, evaluator)
        assert resolved is not None
        fingerprint = config_fingerprint(resolved)
        unit = models.EvalWorkUnit(
            span_rowid=span_rowid,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=fingerprint,
        )
        session.add(unit)
        await session.flush()
        return unit.id, fingerprint


async def _materialize_session_unit(
    db: DbSessionFactory,
    project_session_rowid: int,
    evaluator_id: int,
    criteria_id: int,
) -> tuple[int, str]:
    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        polymorphic = with_polymorphic(
            models.Evaluator,
            [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
        )
        evaluator = await session.scalar(select(polymorphic).where(polymorphic.id == evaluator_id))
        assert evaluator is not None
        project_session = await session.get(models.ProjectSession, project_session_rowid)
        assert project_session is not None
        resolved = await resolve_criteria(session, criteria, evaluator)
        assert resolved is not None
        fingerprint = config_fingerprint(resolved)
        evaluated_through = project_session.last_span_ingested_at
        if evaluated_through is None:
            evaluated_through = datetime.now(timezone.utc)
            project_session.last_span_ingested_at = evaluated_through
        unit = models.EvalSessionWorkUnit(
            project_session_rowid=project_session_rowid,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=fingerprint,
            evaluated_through=evaluated_through,
        )
        session.add(unit)
        await session.flush()
        return unit.id, fingerprint


def _executor(
    db: DbSessionFactory,
    *,
    evaluation_target: models.EvaluationTarget = "SPAN",
    **kwargs: Any,
) -> OnlineEvalExecutor:
    """An executor publishing through a coordinator bound to the same target."""
    return OnlineEvalExecutor(
        db,
        coordinator=DbEvalWorkCoordinator(db, evaluation_target=evaluation_target),
        decrypt=lambda value: value,
        **kwargs,
    )


async def _get_unit(db: DbSessionFactory, unit_id: int) -> models.EvalWorkUnit:
    async with db() as session:
        unit = await session.get(models.EvalWorkUnit, unit_id)
        assert unit is not None
        return unit


async def _get_session_unit(db: DbSessionFactory, unit_id: int) -> models.EvalSessionWorkUnit:
    async with db() as session:
        unit = await session.get(models.EvalSessionWorkUnit, unit_id)
        assert unit is not None
        return unit


async def _annotations(db: DbSessionFactory) -> list[models.SpanAnnotation]:
    async with db() as session:
        return list(await session.scalars(select(models.SpanAnnotation)))


async def test_span_eval_context_nests_span_fields_under_metadata(
    db: DbSessionFactory,
) -> None:
    attributes = {
        "input": {"value": "span input"},
        "output": {"value": "span output"},
        "metadata": {"user": "value"},
        "custom": {"nested": "value"},
    }
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace, attributes=attributes)

        context = span_eval_context(span)

    assert set(context) == {"input", "output", "metadata"}
    assert context == {
        "input": "span input",
        "output": "span output",
        "metadata": {
            "attributes": attributes,
            "name": span.name,
            "span_kind": "LLM",
            "status_code": "OK",
            "status_message": "test_status_message",
        },
    }


async def _session_annotations(
    db: DbSessionFactory,
) -> list[models.ProjectSessionAnnotation]:
    async with db() as session:
        return list(await session.scalars(select(models.ProjectSessionAnnotation)))


async def test_session_publication_then_exhaustion_does_not_rematerialize(
    db: DbSessionFactory,
) -> None:
    scheduled_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    event_time = scheduled_at - timedelta(minutes=1)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        project_session.last_span_ingested_at = scheduled_at
        trace = await _add_trace(session, project, project_session, start_time=event_time)
        await _add_span(session, trace, start_time=event_time)
    evaluator_id, criteria_id = await _seed_builtin_criteria(
        db,
        project.id,
        evaluation_target="SESSION",
    )
    unit_id, fingerprint = await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    coordinator = DbEvalWorkCoordinator(db, evaluation_target="SESSION")
    (unit,) = await coordinator.claim(claimed_by="consumer", limit=1)
    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        criteria.created_at = scheduled_at - timedelta(days=1)
        annotation_name = criteria.name.root

    executor = _executor(db, evaluation_target="SESSION")
    await executor.evaluate_and_annotate(
        unit,
        _hydrated_stub(
            results=[_evaluation_result(annotation_name)],
            evaluator_kind="BUILTIN",
            output_configs=[],
            annotation_name=annotation_name,
            annotation_metadata={
                "phoenix.online_eval.transcript_policy": {
                    "last_retained_event_time": event_time.isoformat()
                }
            },
        ),
    )

    stored = await _get_session_unit(db, unit_id)
    assert stored.status == "RUNNING"
    assert stored.evaluated_through == scheduled_at
    assert stored.transcript_covered_through == event_time
    (annotation,) = await _session_annotations(db)
    assert annotation.identifier == annotation_identifier(fingerprint)
    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_id)
            .values(
                attempts=MAX_ATTEMPTS - 1,
                claimed_at=datetime.now(timezone.utc) - timedelta(seconds=LEASE_TTL_SECONDS + 1),
            )
        )

    await SessionEvalSweeper(db)._tick()
    async with db() as session:
        units = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit).where(
                    models.EvalSessionWorkUnit.project_session_rowid == project_session.id,
                    models.EvalSessionWorkUnit.evaluator_id == evaluator_id,
                    models.EvalSessionWorkUnit.config_fingerprint == fingerprint,
                )
            )
        )
    assert len(units) == 1
    assert units[0].status == "ERROR"
    assert units[0].attempts == MAX_ATTEMPTS


async def test_incomplete_session_hydration_expires_without_counting_attempt(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        project_session.content_complete = False
        trace = await _add_trace(session, project, project_session)
        await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(
        db,
        project.id,
        evaluation_target="SESSION",
    )
    unit_id, _ = await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    async with db() as session:
        last_span_ingested_at = await session.scalar(
            select(models.ProjectSession.last_span_ingested_at).where(
                models.ProjectSession.id == project_session.id
            )
        )
    assert last_span_ingested_at is not None
    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluation_target="SESSION",
    )
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )

    assert await consumer._executor.hydrate(unit) == HydrationFailure(
        HydrationFailureReason.SESSION_CONTENT_INCOMPLETE
    )
    await consumer._process_unit(unit)

    stored = await _get_session_unit(db, unit_id)
    assert stored.status == "EXPIRED"
    assert stored.attempts == 0
    assert stored.evaluated_through == last_span_ingested_at
    assert await _session_annotations(db) == []


def _transcript_policy(
    max_transcript_bytes: int,
    *,
    max_turns: int = MAX_SESSION_EVAL_TURNS,
) -> SessionTranscriptPolicy:
    return SessionTranscriptPolicy(
        max_transcript_bytes=max_transcript_bytes,
        max_llm_message_bytes=4_096,
        max_turns=max_turns,
    )


def test_session_eval_context_truncates_oldest_whole_turns_by_utf8_bytes() -> None:
    turns = [
        {
            "input": f"question-{index}-" + "🙂" * 40,
            "output": f"answer-{index}-" + "界" * 40,
            "metadata": {"index": index},
        }
        for index in range(3)
    ]
    retained_blocks = [f"User: {turn['input']}\nAssistant: {turn['output']}" for turn in turns[1:]]
    expected_transcript = "[transcript truncated: first 1 turns omitted]\n\n" + "\n\n".join(
        retained_blocks
    )

    context = session_eval_context(
        turns=turns,
        policy=_transcript_policy(len(expected_transcript.encode("utf-8"))),
    )

    assert set(context) == {"input", "output", "metadata"}
    assert context["input"] == expected_transcript
    assert len(context["input"].encode("utf-8")) <= len(expected_transcript.encode("utf-8"))
    assert context["output"] == turns[-1]["output"]
    assert context["metadata"]["turns"] == turns
    policy = context["metadata"]["phoenix.online_eval.transcript_policy"]
    assert policy["total_eligible_root_count"] == 3
    assert policy["loaded_turn_count"] == 3
    assert policy["retained_turn_count"] == 2
    assert policy["turn_cap_omitted_count"] == 0
    assert policy["byte_cap_omitted_count"] == 1

    omitted_turn = {"input": "x" * 500, "output": "y" * 500, "metadata": {}}
    omitted_transcript = f"User: {omitted_turn['input']}\nAssistant: {omitted_turn['output']}"
    with pytest.raises(TranscriptTooLargeError) as exc_info:
        session_eval_context(
            turns=[omitted_turn],
            policy=_transcript_policy(256),
        )
    error = str(exc_info.value)
    assert f"{len(omitted_transcript.encode('utf-8'))} bytes" in error
    assert "256-byte cap" in error
    assert "PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES" in error
    assert "Raise" in error

    null_values = session_eval_context(
        turns=[{"input": None, "output": None, "metadata": {"raw": True}}],
        policy=_transcript_policy(256),
    )
    assert null_values["input"] == "User: \nAssistant: "
    assert null_values["output"] == ""
    assert null_values["metadata"]["turns"] == [
        {"input": None, "output": None, "metadata": {"raw": True}}
    ]

    empty = session_eval_context(
        turns=[],
        policy=_transcript_policy(256),
    )
    assert empty["input"] == ""
    assert empty["output"] == ""
    assert empty["metadata"]["turns"] == []


async def test_happy_path_claims_evaluates_annotates_and_completes(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(
            session,
            trace,
            attributes={"input": {"value": "hi"}, "output": {"value": "there"}},
        )
    evaluator_id, criteria_id = await _seed_llm_criteria(db, project.id)
    unit_id, fingerprint = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    _patch_playground_client(monkeypatch, _StubLLMClient())

    consumer = OnlineEvalConsumer(db, decrypt=lambda b: b)
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "DONE"
    annotations = await _annotations(db)
    assert len(annotations) == 1
    annotation = annotations[0]
    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        assert annotation.name == criteria.name.root
    assert annotation.span_rowid == span.id
    assert annotation.label == "good"
    assert annotation.score == 1.0
    assert annotation.explanation == "looks good"
    assert annotation.annotator_kind == "LLM"
    assert annotation.source == "API"
    assert annotation.identifier == annotation_identifier(fingerprint)

    # Nothing is claimable afterwards; a repeat cycle writes nothing new.
    await consumer._cycle()
    assert len(await _annotations(db)) == 1


async def test_custom_provider_materializes_claims_executes_and_annotates(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_llm_criteria(
        db,
        project.id,
        custom_provider=True,
    )
    unit_id, fingerprint = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    _patch_playground_client(monkeypatch, _StubLLMClient())

    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "DONE"
    (annotation,) = await _annotations(db)
    assert annotation.span_rowid == span.id
    assert annotation.identifier == annotation_identifier(fingerprint)


async def test_configuration_versions_are_resolved_once_per_claim_batch(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(3)]
    evaluator_id, criteria_id = await _seed_llm_criteria(db, project.id)
    unit_ids = [
        (await _materialize_unit(db, span.id, evaluator_id, criteria_id))[0] for span in spans
    ]
    client = _StubLLMClient()
    _patch_playground_client(monkeypatch, client)
    call_sizes: list[int] = []

    async def _counting_resolver(*args: Any, **kwargs: Any) -> Any:
        call_sizes.append(len(args[1]))
        return await resolve_criteria_bulk(*args, **kwargs)

    monkeypatch.setattr(executor_module, "resolve_criteria_bulk", _counting_resolver)

    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        # The batch runs concurrently; SQLite needs its database work serialized, which
        # is the db semaphore's job in a deployed consumer too.
        db_semaphore=asyncio.Semaphore(1),
    )
    await consumer._cycle()

    assert call_sizes == [1]
    units = [await _get_unit(db, unit_id) for unit_id in unit_ids]
    assert all(unit.status == "DONE" for unit in units)
    assert len(client.requests) == 3


@pytest.mark.postgres_only
async def test_hydration_savepoint_isolates_a_unit_database_error(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        bad_span = await _add_span(session, trace)
        good_span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_llm_criteria(db, project.id)
    bad_unit_id, _ = await _materialize_unit(db, bad_span.id, evaluator_id, criteria_id)
    good_unit_id, _ = await _materialize_unit(db, good_span.id, evaluator_id, criteria_id)
    _patch_playground_client(monkeypatch, _StubLLMClient())
    original = OnlineEvalExecutor._hydrate_target_context

    async def _fail_one_target(
        executor: OnlineEvalExecutor,
        session: Any,
        unit: ClaimedWorkUnit,
        *,
        project_id: int,
    ) -> Any:
        if unit.target_rowid == bad_span.id:
            await session.execute(text("SELECT 1 / 0"))
        return await original(executor, session, unit, project_id=project_id)

    monkeypatch.setattr(OnlineEvalExecutor, "_hydrate_target_context", _fail_one_target)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)

    await consumer._cycle()

    bad_unit = await _get_unit(db, bad_unit_id)
    good_unit = await _get_unit(db, good_unit_id)
    assert bad_unit.status == "ERROR"
    assert bad_unit.attempts == 1
    assert good_unit.status == "DONE"


@pytest.mark.postgres_only
async def test_shared_hydration_failure_releases_claims_without_attempts(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(2)]
    evaluator_id, criteria_id = await _seed_llm_criteria(db, project.id)
    unit_ids = [
        (await _materialize_unit(db, span.id, evaluator_id, criteria_id))[0] for span in spans
    ]

    async def _fail_shared_query(session: Any, rows: Any) -> Any:
        await session.execute(text("SELECT 1 / 0"))

    monkeypatch.setattr(executor_module, "resolve_criteria_bulk", _fail_shared_query)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)

    await consumer._cycle()

    units = [await _get_unit(db, unit_id) for unit_id in unit_ids]
    assert all(unit.status == "PENDING" for unit in units)
    assert all(unit.attempts == 0 for unit in units)
    assert all(unit.claimed_by is None and unit.claimed_at is None for unit in units)


async def test_configuration_snapshot_is_discarded_after_claim_batch(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(2)]
    evaluator_id, criteria_id = await _seed_llm_criteria(db, project.id)
    unit_ids = [
        (await _materialize_unit(db, span.id, evaluator_id, criteria_id))[0] for span in spans
    ]
    client = _StubLLMClient()
    _patch_playground_client(monkeypatch, client)
    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        claim_batch_size=1,
    )

    await consumer._cycle()
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluatorCriteria)
            .where(models.ProjectEvaluatorCriteria.id == criteria_id)
            .values(sampling_rate=0.5)
        )
    await consumer._cycle()

    units = [await _get_unit(db, unit_id) for unit_id in unit_ids]
    assert [unit.status for unit in units] == ["DONE", "EXPIRED"]
    assert units[1].error == "CONFIG_FINGERPRINT_MISMATCH"
    assert len(client.requests) == 1


async def test_session_happy_path_builds_context_annotates_and_emits_insert_event(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        SessionTranscriptPolicy,
        "from_env",
        classmethod(lambda cls: _transcript_policy(32_768, max_turns=2)),
    )
    start_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(
            session,
            project,
            session_id="session-eval",
            start_time=start_time,
        )
        project_session.end_time = start_time + timedelta(seconds=90)
        oldest_trace = await _add_trace(
            session,
            project,
            project_session,
            start_time=start_time + timedelta(seconds=1),
        )
        await _add_span(
            session,
            oldest_trace,
            span_kind="CHAIN",
            start_time=start_time + timedelta(seconds=1),
            attributes={
                "input": {"value": "omitted oldest question"},
                "output": {"value": "omitted oldest answer"},
                "metadata": {"turn": 0},
            },
        )
        trace_without_root = await _add_trace(
            session,
            project,
            project_session,
            start_time=start_time + timedelta(seconds=5),
        )
        assert trace_without_root.project_session_rowid == project_session.id
        later_trace = await _add_trace(
            session,
            project,
            project_session,
            start_time=start_time + timedelta(seconds=20),
        )
        later_root = await _add_span(
            session,
            later_trace,
            span_kind="CHAIN",
            start_time=start_time + timedelta(seconds=20),
            attributes={
                "input": {"value": "second question"},
                "output": {"value": "second answer"},
                "metadata": {"turn": 2},
            },
        )
        await _add_span(
            session,
            later_trace,
            span_kind="CHAIN",
            start_time=start_time + timedelta(seconds=21),
            attributes={
                "input": {"value": "duplicate root question"},
                "output": {"value": "duplicate root answer"},
                "metadata": {"turn": 99},
            },
        )
        await _add_span(
            session,
            parent_span=later_root,
            span_kind="LLM",
            llm_token_count_prompt=5,
            llm_token_count_completion=6,
        )
        earlier_trace = await _add_trace(
            session,
            project,
            project_session,
            start_time=start_time + timedelta(seconds=10),
        )
        earlier_root = await _add_span(
            session,
            earlier_trace,
            span_kind="CHAIN",
            start_time=start_time + timedelta(seconds=10),
            attributes={
                "input": {"value": "first question"},
                "output": {"value": "first answer"},
                "metadata": {"turn": 1},
            },
        )
        await _add_span(
            session,
            parent_span=earlier_root,
            span_kind="LLM",
            llm_token_count_prompt=3,
            llm_token_count_completion=4,
        )
    evaluator_id, criteria_id = await _seed_llm_criteria(
        db,
        project.id,
        evaluation_target="SESSION",
        template_content=(
            "{{input}}\nOUTPUT={{output}}\n"
            "TURNS={{#metadata.turns}}{{input}}/{{output}}/{{metadata.turn}};"
            "{{/metadata.turns}}"
        ),
    )
    unit_id, fingerprint = await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    client = _StubLLMClient()
    _patch_playground_client(monkeypatch, client)
    events: SimpleQueue[DmlEvent] = SimpleQueue()

    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        event_queue=events,
        evaluation_target="SESSION",
    )
    await consumer._cycle()

    assert (await _get_session_unit(db, unit_id)).status == "DONE"
    assert len(client.requests) == 1
    assert client.requests[0]["messages"][0]["content"] == (
        "User: first question\nAssistant: first answer\n\n"
        "User: second question\nAssistant: second answer\n"
        "OUTPUT=second answer\n"
        "TURNS=first question/first answer/1;second question/second answer/2;"
    )
    (annotation,) = await _session_annotations(db)
    assert annotation.project_session_id == project_session.id
    assert annotation.label == "good"
    assert annotation.score == 1.0
    assert annotation.explanation == "looks good"
    assert annotation.annotator_kind == "LLM"
    assert annotation.source == "API"
    assert annotation.identifier == annotation_identifier(fingerprint)
    policy = annotation.metadata_["phoenix.online_eval.transcript_policy"]
    assert policy["ordering"] == "trace_start_time_then_trace_id_with_earliest_root_span"
    assert policy["total_eligible_root_count"] == 3
    assert policy["loaded_turn_count"] == 2
    assert policy["retained_turn_count"] == 2
    assert policy["turn_cap_omitted_count"] == 1
    assert policy["byte_cap_omitted_count"] == 0
    assert policy["first_retained_event_time"] is not None
    assert policy["last_retained_event_time"] is not None
    assert policy["structured_turns_mapped"] is True
    assert events.get_nowait() == ProjectSessionAnnotationInsertEvent((annotation.id,))
    assert events.empty()

    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        annotation_name = criteria.name.root
    duplicate = _claimed_session_unit(
        project_session.id,
        identifier=annotation_identifier(fingerprint),
        work_unit_id=unit_id,
    )
    duplicate_hydrated = _hydrated_stub(
        results=[_evaluation_result(annotation_name)],
        evaluator_kind="LLM",
        output_configs=[_output_config("quality")],
        annotation_name=annotation_name,
    )
    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_id)
            .values(
                status="RUNNING",
                claimed_by=duplicate.claimed_by,
                claimed_at=datetime.now(timezone.utc),
            )
        )
    await consumer._executor.evaluate_and_annotate(duplicate, duplicate_hydrated)
    (replacement,) = await _session_annotations(db)
    assert replacement.id == annotation.id
    assert events.get_nowait() == ProjectSessionAnnotationInsertEvent((annotation.id,))
    assert events.empty()


async def test_session_publication_preserves_ingest_and_records_transcript_watermarks(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    start_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    duplicate_root_time = start_time + timedelta(seconds=30)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project, start_time=start_time)
        # Materialization sees only what had been ingested by sweep time.
        project_session.last_span_ingested_at = start_time + timedelta(seconds=5)
        trace = await _add_trace(session, project, project_session, start_time=start_time)
        await _add_span(session, trace, span_kind="CHAIN", start_time=start_time)
        await _add_span(session, trace, span_kind="CHAIN", start_time=duplicate_root_time)
    evaluator_id, criteria_id = await _seed_llm_criteria(
        db,
        project.id,
        evaluation_target="SESSION",
    )
    unit_id, _ = await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    _patch_playground_client(monkeypatch, _StubLLMClient())

    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value, evaluation_target="SESSION")
    await consumer._cycle()

    unit = await _get_session_unit(db, unit_id)
    assert unit.status == "DONE"
    assert unit.evaluated_through == start_time + timedelta(seconds=5)
    assert unit.transcript_covered_through == start_time


async def test_reclaimed_session_publication_pairs_annotation_with_new_coverage(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    first_event_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    first_ingest_time = first_event_time + timedelta(minutes=2)
    second_event_time = first_event_time + timedelta(minutes=1)
    second_ingest_time = first_ingest_time + timedelta(minutes=1)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(
            session,
            project,
            start_time=first_event_time,
        )
        trace = await _add_trace(
            session,
            project,
            project_session,
            start_time=first_event_time,
        )
        await _add_span(session, trace, span_kind="CHAIN", start_time=first_event_time)
        project_session.last_span_ingested_at = first_ingest_time
    evaluator_id, criteria_id = await _seed_llm_criteria(
        db,
        project.id,
        evaluation_target="SESSION",
    )
    unit_id, _ = await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    _patch_playground_client(monkeypatch, _StubLLMClient())
    coordinator = DbEvalWorkCoordinator(db, evaluation_target="SESSION")
    executor = _executor(db, evaluation_target="SESSION")

    (first_claim,) = await coordinator.claim(claimed_by="attempt-a", limit=1)
    first_hydrated = await executor.hydrate(first_claim)
    assert isinstance(first_hydrated, HydratedWorkUnit)
    await executor.evaluate_and_annotate(first_claim, first_hydrated)

    async with db() as session:
        second_trace = await _add_trace(
            session,
            project,
            project_session,
            start_time=second_event_time,
        )
        await _add_span(
            session,
            second_trace,
            span_kind="CHAIN",
            start_time=second_event_time,
        )
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session.id)
            .values(last_span_ingested_at=second_ingest_time)
        )
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_id)
            .values(
                claimed_at=datetime.now(timezone.utc) - timedelta(seconds=LEASE_TTL_SECONDS + 1)
            )
        )

    (second_claim,) = await coordinator.claim(claimed_by="attempt-b", limit=1)
    second_hydrated = await executor.hydrate(second_claim)
    assert isinstance(second_hydrated, HydratedWorkUnit)
    await executor.evaluate_and_annotate(second_claim, second_hydrated)
    assert await coordinator.complete(
        work_unit_id=unit_id,
        claimed_by=second_claim.claimed_by,
    )

    unit = await _get_session_unit(db, unit_id)
    (annotation,) = await _session_annotations(db)
    policy = annotation.metadata_["phoenix.online_eval.transcript_policy"]
    assert policy["last_retained_event_time"] == second_event_time.isoformat()
    assert unit.evaluated_through == first_ingest_time
    assert unit.transcript_covered_through == second_event_time


async def test_marker_only_session_transcript_is_terminal_without_counting_attempt(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    input_value = "x" * 500
    output_value = "y" * 500
    transcript = f"User: {input_value}\nAssistant: {output_value}"
    # The cap is fingerprinted, so it has to be in force before materialization or
    # the unit expires on the staleness guard instead of reaching the transcript.
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES", "256")
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        await _add_span(
            session,
            trace,
            attributes={
                "input": {"value": input_value},
                "output": {"value": output_value},
            },
        )
    evaluator_id, criteria_id = await _seed_llm_criteria(
        db,
        project.id,
        evaluation_target="SESSION",
    )
    unit_id, _ = await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    client = _StubLLMClient()
    _patch_playground_client(monkeypatch, client)

    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluation_target="SESSION",
    )
    await consumer._cycle()

    unit = await _get_session_unit(db, unit_id)
    assert unit.status == "EXPIRED"
    assert unit.attempts == 0
    assert unit.error is not None
    assert unit.error.startswith("TRANSCRIPT_TOO_LARGE: ")
    assert f"{len(transcript.encode('utf-8'))} bytes" in unit.error
    assert "256-byte cap" in unit.error
    assert "PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES" in unit.error
    assert client.requests == []
    assert await _session_annotations(db) == []


async def test_cross_project_session_unit_expires_before_evaluator_call(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        criteria_project = await _add_project(session)
        session_project = await _add_project(session)
        foreign_project_session = await _add_project_session(session, session_project)
        trace = await _add_trace(session, session_project, foreign_project_session)
        await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_llm_criteria(
        db,
        criteria_project.id,
        evaluation_target="SESSION",
    )
    unit_id, _ = await _materialize_session_unit(
        db,
        foreign_project_session.id,
        evaluator_id,
        criteria_id,
    )
    client = _StubLLMClient()
    _patch_playground_client(monkeypatch, client)

    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluation_target="SESSION",
    )
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )
    assert await consumer._executor.hydrate(unit) == HydrationFailure(
        HydrationFailureReason.SESSION_PROJECT_MISMATCH
    )
    await consumer._process_unit(unit)

    assert (await _get_session_unit(db, unit_id)).status == "EXPIRED"
    assert client.requests == []
    assert await _session_annotations(db) == []


async def test_session_hydration_excludes_transferred_trace_roots(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        criteria_project = await _add_project(session)
        destination_project = await _add_project(session)
        project_session = await _add_project_session(session, criteria_project)
        trace = await _add_trace(session, criteria_project, project_session)
        await _add_span(session, trace)
        trace.project_rowid = destination_project.id
    evaluator_id, criteria_id = await _seed_llm_criteria(
        db,
        criteria_project.id,
        evaluation_target="SESSION",
    )
    unit_id, _ = await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    client = _StubLLMClient()
    _patch_playground_client(monkeypatch, client)
    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluation_target="SESSION",
    )

    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )
    assert await consumer._executor.hydrate(unit) == HydrationFailure(
        HydrationFailureReason.NO_ROOT_TURNS
    )
    await consumer._process_unit(unit)

    stored = await _get_session_unit(db, unit_id)
    assert stored.status == "EXPIRED"
    assert stored.attempts == 0
    assert stored.error == "NO_ROOT_TURNS"
    assert client.requests == []
    assert await _session_annotations(db) == []


async def test_session_criteria_becoming_unschedulable_expires_before_evaluator_call(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_llm_criteria(
        db,
        project.id,
        evaluation_target="SESSION",
    )
    unit_id, _ = await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluatorCriteria)
            .where(models.ProjectEvaluatorCriteria.id == criteria_id)
            .values(filter_condition="span_kind == 'LLM'")
        )
    client = _StubLLMClient()
    _patch_playground_client(monkeypatch, client)

    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluation_target="SESSION",
    )
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )
    assert await consumer._executor.hydrate(unit) == HydrationFailure(
        HydrationFailureReason.CRITERIA_NOT_SCHEDULABLE
    )
    await consumer._process_unit(unit)

    assert (await _get_session_unit(db, unit_id)).status == "EXPIRED"
    assert client.requests == []
    assert await _session_annotations(db) == []


async def test_session_code_hydration_supplies_configured_payload_cap(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_code_criteria(
        db,
        project.id,
        criteria_input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        evaluation_target="SESSION",
    )
    await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    coordinator = DbEvalWorkCoordinator(db, evaluation_target="SESSION")
    (unit,) = await coordinator.claim(claimed_by="consumer", limit=1)
    manager = _StubSandboxSessionManager()
    captured_runner_arguments: dict[str, Any] = {}

    async def _build_backend(*_: Any, **__: Any) -> _StubSandboxBackend:
        return _StubSandboxBackend()

    def _build_runner(**kwargs: Any) -> _StubEvaluator:
        captured_runner_arguments.update(kwargs)
        return _StubEvaluator([])

    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES", "2048")
    monkeypatch.setattr(executor_module, "build_sandbox_backend", _build_backend)
    monkeypatch.setattr(executor_module, "CodeEvaluatorRunner", _build_runner)
    executor = _executor(db, sandbox_session_manager=cast(Any, manager))

    hydrated = await executor.hydrate(unit)

    assert isinstance(hydrated, HydratedWorkUnit)
    assert captured_runner_arguments["max_payload_bytes"] == 2048
    assert captured_runner_arguments["timeout"] < captured_runner_arguments["runner_timeout"] < 600
    assert (
        captured_runner_arguments["payload_limit_remediation"]
        == "Reduce the dominant evaluator source or mapped inputs, or raise the limit with "
        "PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES."
    )


async def test_span_code_hydration_supplies_configured_payload_cap(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_code_criteria(
        db,
        project.id,
        criteria_input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
    )
    await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    coordinator = DbEvalWorkCoordinator(db)
    (unit,) = await coordinator.claim(claimed_by="consumer", limit=1)
    manager = _StubSandboxSessionManager()
    captured_runner_arguments: dict[str, Any] = {}

    async def _build_backend(*_: Any, **__: Any) -> _StubSandboxBackend:
        return _StubSandboxBackend()

    def _build_runner(**kwargs: Any) -> _StubEvaluator:
        captured_runner_arguments.update(kwargs)
        return _StubEvaluator([])

    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES", "2048")
    monkeypatch.setattr(executor_module, "build_sandbox_backend", _build_backend)
    monkeypatch.setattr(executor_module, "CodeEvaluatorRunner", _build_runner)
    executor = _executor(db, sandbox_session_manager=cast(Any, manager))

    hydrated = await executor.hydrate(unit)

    assert isinstance(hydrated, HydratedWorkUnit)
    assert captured_runner_arguments["max_payload_bytes"] == 2048


async def test_llm_criteria_input_mapping_override_is_used_during_execution(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(
            session,
            trace,
            attributes={"remapped": {"question": "mapped question"}},
        )
    evaluator_id, criteria_id = await _seed_llm_criteria(
        db,
        project.id,
        template_content="Question: {{question}}\nAnswer: {{answer}}",
        criteria_input_mapping=InputMapping(
            path_mapping={"question": "metadata.attributes.remapped.question"},
            literal_mapping={"answer": "literal answer"},
        ),
    )
    await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    client = _StubLLMClient()
    _patch_playground_client(monkeypatch, client)

    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    await consumer._cycle()

    assert len(client.requests) == 1
    messages = client.requests[0]["messages"]
    assert messages[0]["content"] == "Question: mapped question\nAnswer: literal answer"
    assert len(await _annotations(db)) == 1


async def test_builtin_criteria_input_mapping_override_is_used_during_execution(
    db: DbSessionFactory,
    synced_builtin_evaluators: None,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(
            session,
            trace,
            attributes={"remapped": {"text": "the mapped value is present"}},
        )
        evaluator_id = await session.scalar(
            select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
        )
        assert evaluator_id is not None
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project.id,
            evaluator_id=evaluator_id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
            input_mapping=InputMapping(
                path_mapping={"text": "metadata.attributes.remapped.text"},
                literal_mapping={"words": "mapped value"},
            ),
        )
        session.add(criteria)
        await session.flush()
        criteria_id = criteria.id
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)

    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    await consumer._cycle()

    assert (await _get_unit(db, unit_id)).status == "DONE"
    (annotation,) = await _annotations(db)
    assert annotation.label == "true"
    assert annotation.score == 1.0


async def test_builtin_implementation_mismatch_expires_without_counting_attempt(
    db: DbSessionFactory,
    synced_builtin_evaluators: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
        evaluator_id = await session.scalar(
            select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
        )
        assert evaluator_id is not None
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project.id,
            evaluator_id=evaluator_id,
            name=Identifier(root="contains-version-check"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(criteria)
        await session.flush()
        criteria_id = criteria.id
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    monkeypatch.setattr(ContainsEvaluator, "implementation_version", "mismatched")

    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "EXPIRED"
    assert unit.attempts == 0
    assert unit.error == "CONFIG_FINGERPRINT_MISMATCH"


async def test_code_criteria_input_mapping_override_is_used_during_execution(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(
            session,
            trace,
            attributes={"remapped": {"value": "mapped context"}},
        )
    evaluator_id, criteria_id = await _seed_code_criteria(
        db,
        project.id,
        criteria_input_mapping=InputMapping(
            path_mapping={"output": "metadata.attributes.remapped.value"},
            literal_mapping={"metadata": "criteria literal"},
        ),
    )
    await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    coordinator = DbEvalWorkCoordinator(db)
    (unit,) = await coordinator.claim(claimed_by="consumer", limit=1)
    manager = _StubSandboxSessionManager()

    async def _build_backend(*_: Any, **__: Any) -> _StubSandboxBackend:
        return _StubSandboxBackend()

    monkeypatch.setattr(executor_module, "build_sandbox_backend", _build_backend)
    executor = _executor(db, sandbox_session_manager=cast(Any, manager))
    hydrated = await executor.hydrate(unit)
    assert isinstance(hydrated, HydratedWorkUnit)

    await executor.evaluate_and_annotate(unit, hydrated)

    (executed_code,) = manager.session.executed_code
    assert "mapped context" in executed_code
    assert "criteria literal" in executed_code
    assert "evaluator default" not in executed_code
    assert manager.session_keys == [f"online-eval:{evaluator_id}:test-replica"]
    annotation = (await _annotations(db))[0]
    assert annotation.score == 0.75


@pytest.mark.parametrize(
    "configuration_state",
    ["missing", "disabled", "provider_disabled"],
)
async def test_unavailable_sandbox_runtime_expires_without_counting_attempt(
    db: DbSessionFactory,
    configuration_state: str,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_code_criteria(
        db,
        project.id,
        criteria_input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
    )
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    async with db() as session:
        evaluator = await session.get(models.CodeEvaluator, evaluator_id)
        assert evaluator is not None
        if configuration_state == "missing":
            evaluator.sandbox_config_id = None
        else:
            assert evaluator.sandbox_config_id is not None
            sandbox_config = await session.get(models.SandboxConfig, evaluator.sandbox_config_id)
            assert sandbox_config is not None
            if configuration_state == "disabled":
                sandbox_config.enabled = False
            else:
                provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
                assert provider is not None
                provider.enabled = False

    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        sandbox_session_manager=cast(Any, _StubSandboxSessionManager()),
    )
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "EXPIRED"
    assert unit.attempts == 0
    assert unit.error == "SANDBOX_RUNTIME_UNAVAILABLE"
    assert await _annotations(db) == []


async def test_reclaimed_execution_writes_one_annotation_and_one_insert_event(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(
            session,
            trace,
            attributes={"input": {"value": "hi"}, "output": {"value": "there"}},
        )
    evaluator_id, criteria_id = await _seed_llm_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    _patch_playground_client(monkeypatch, _StubLLMClient())
    coordinator = DbEvalWorkCoordinator(db)

    (first_claim,) = await coordinator.claim(claimed_by="consumer-1", limit=1)
    lapsed = datetime.now(timezone.utc) - timedelta(seconds=LEASE_TTL_SECONDS + 1)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_id)
            .values(claimed_at=lapsed)
        )
    (reclaimed,) = await coordinator.claim(claimed_by="consumer-2", limit=1)
    assert reclaimed.work_unit_id == first_claim.work_unit_id
    assert reclaimed.identifier == first_claim.identifier

    events: SimpleQueue[DmlEvent] = SimpleQueue()
    executor = _executor(db, event_queue=events)
    first_hydrated = await executor.hydrate(first_claim)
    reclaimed_hydrated = await executor.hydrate(reclaimed)
    assert isinstance(first_hydrated, HydratedWorkUnit)
    assert isinstance(reclaimed_hydrated, HydratedWorkUnit)

    with pytest.raises(PublicationClaimLostError):
        await executor.evaluate_and_annotate(first_claim, first_hydrated)
    await executor.evaluate_and_annotate(reclaimed, reclaimed_hydrated)

    annotations = await _annotations(db)
    assert len(annotations) == 1
    assert events.get_nowait() == SpanAnnotationInsertEvent((annotations[0].id,))
    assert events.empty()


async def test_llm_incomplete_result_set_writes_nothing(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    output_configs = [_output_config("quality"), _output_config("relevance")]
    hydrated = _hydrated_stub(
        results=[_evaluation_result("criterion.quality")],
        evaluator_kind="LLM",
        output_configs=output_configs,
    )
    executor = _executor(db)
    unit = await _claim_materialized_unit(
        db,
        project_id=project.id,
        span_rowid=span.id,
    )

    with pytest.raises(EvalExecutionError, match="invalid result set"):
        await executor.evaluate_and_annotate(unit, hydrated)

    assert await _annotations(db) == []


async def test_duplicate_output_name_writes_nothing(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    hydrated = _hydrated_stub(
        results=[
            _evaluation_result("criterion"),
            _evaluation_result("criterion"),
        ],
        evaluator_kind="LLM",
        output_configs=[_output_config("quality")],
    )
    executor = _executor(db)
    unit = await _claim_materialized_unit(
        db,
        project_id=project.id,
        span_rowid=span.id,
    )

    with pytest.raises(EvaluatorResultValidationError, match="'criterion': 2"):
        await executor.evaluate_and_annotate(unit, hydrated)

    assert await _annotations(db) == []


@pytest.mark.parametrize("invalid_label", ["unknown", 1, {"label": "good"}])
async def test_invalid_categorical_label_writes_nothing(
    db: DbSessionFactory,
    invalid_label: Any,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    result = _evaluation_result("criterion")
    result["label"] = invalid_label
    hydrated = _hydrated_stub(
        results=[result],
        evaluator_kind="LLM",
        output_configs=[_output_config("quality")],
    )
    executor = _executor(db)
    unit = await _claim_materialized_unit(
        db,
        project_id=project.id,
        span_rowid=span.id,
    )

    with pytest.raises(EvaluatorResultValidationError, match="invalid label"):
        await executor.evaluate_and_annotate(unit, hydrated)

    assert await _annotations(db) == []


async def test_code_mixed_result_set_writes_nothing(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    output_configs = [_output_config("quality"), _output_config("relevance")]
    original_error = RuntimeError("second output failed")
    hydrated = _hydrated_stub(
        results=[
            _evaluation_result("criterion.quality"),
            _evaluation_result(
                "criterion.relevance",
                error="second output failed",
                error_exc=original_error,
            ),
        ],
        evaluator_kind="CODE",
        output_configs=output_configs,
    )
    executor = _executor(db)
    unit = await _claim_materialized_unit(
        db,
        project_id=project.id,
        span_rowid=span.id,
    )

    with pytest.raises(EvalExecutionError, match="second output failed") as exc_info:
        await executor.evaluate_and_annotate(unit, hydrated)

    assert exc_info.value.__cause__ is original_error
    assert await _annotations(db) == []


async def test_complete_result_set_is_written_atomically(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    output_configs = [_output_config("quality"), _output_config("relevance")]
    hydrated = _hydrated_stub(
        results=[
            _evaluation_result("criterion.quality"),
            _evaluation_result("criterion.relevance"),
        ],
        evaluator_kind="CODE",
        output_configs=output_configs,
    )
    executor = _executor(db)
    unit = await _claim_materialized_unit(
        db,
        project_id=project.id,
        span_rowid=span.id,
    )

    await executor.evaluate_and_annotate(unit, hydrated)

    annotations = await _annotations(db)
    assert {annotation.name for annotation in annotations} == {
        "criterion.quality",
        "criterion.relevance",
    }


async def test_deleted_criteria_cannot_publish_annotation(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    coordinator = DbEvalWorkCoordinator(db)
    (unit,) = await coordinator.claim(claimed_by="consumer", limit=1)
    hydrated = _hydrated_stub(
        results=[_evaluation_result("criterion")],
        evaluator_kind="LLM",
        output_configs=[_output_config("quality")],
    )
    executor = _executor(db)
    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        await session.delete(criteria)

    with pytest.raises(PublicationClaimLostError):
        await executor.evaluate_and_annotate(unit, hydrated)

    assert await _annotations(db) == []
    async with db() as session:
        assert await session.get(models.EvalWorkUnit, unit_id) is None


async def test_evaluator_error_fails_unit_with_cooldown_and_no_annotation(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(
            session,
            trace,
            attributes={"input": {"value": "hi"}, "output": {"value": "there"}},
        )
    evaluator_id, criteria_id = await _seed_llm_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    _patch_playground_client(monkeypatch, _StubLLMClient(error=RuntimeError("provider is down")))

    consumer = OnlineEvalConsumer(db, decrypt=lambda b: b)
    before = datetime.now(timezone.utc)
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "ERROR"
    assert unit.attempts == 1
    assert unit.error is not None
    assert "provider is down" in unit.error
    assert unit.cooldown_until is not None
    assert unit.cooldown_until > before
    assert await _annotations(db) == []


async def test_transient_provider_error_retries_without_burning_attempts(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A provider outage (network/timeout/5xx) must not walk a unit toward
    MAX_ATTEMPTS: an outage longer than the retry budget would otherwise turn
    every claimed unit terminally ERROR — permanent silent eval loss. Transient
    failures cool down without counting an attempt, then complete once the
    provider heals."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(
            session,
            trace,
            attributes={"input": {"value": "hi"}, "output": {"value": "there"}},
        )
    evaluator_id, criteria_id = await _seed_llm_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    _patch_playground_client(
        monkeypatch, _StubLLMClient(error=httpx.ConnectError("provider unreachable"))
    )

    consumer = OnlineEvalConsumer(db, decrypt=lambda b: b)
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "ERROR"
    assert unit.attempts == 0  # the outage did not consume a retry
    assert unit.error is not None
    assert "provider unreachable" in unit.error
    assert unit.cooldown_until is not None
    assert await _annotations(db) == []

    # Once the cooldown lapses and the provider heals, the unit completes.
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_id)
            .values(cooldown_until=datetime.now(timezone.utc))
        )
    _patch_playground_client(monkeypatch, _StubLLMClient())
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "DONE"
    assert unit.attempts == 0
    assert len(await _annotations(db)) == 1


async def test_provider_classifier_handles_provider_specific_error_shape(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _ProviderError(Exception):
        provider_rate_limit = True

    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_llm_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    _patch_playground_client(
        monkeypatch,
        _StubLLMClient(error=_ProviderError("provider-specific throttle")),
    )

    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "ERROR"
    assert unit.attempts == 0
    assert unit.error is not None
    assert "provider-specific throttle" in unit.error


def test_is_transient_error_classification() -> None:
    request = httpx.Request("POST", "http://provider.test")
    assert is_transient_error(TimeoutError("llm timed out"))
    assert is_transient_error(asyncio.TimeoutError())
    assert is_transient_error(ConnectionError("reset"))
    assert is_transient_error(httpx.ConnectTimeout("t", request=request))
    assert is_transient_error(
        httpx.HTTPStatusError("503", request=request, response=httpx.Response(503, request=request))
    )
    # Wrapped errors classify by their root cause through the exception chain.
    try:
        try:
            raise TimeoutError("llm timed out")
        except TimeoutError as inner:
            raise EvalExecutionError("wrapped") from inner
    except EvalExecutionError as wrapped:
        assert is_transient_error(wrapped)
    # Fail-safe default: anything unrecognized counts attempts as usual.
    assert not is_transient_error(RuntimeError("provider is down"))
    assert not is_transient_error(ValueError("bad config"))
    assert not is_transient_error(EvalExecutionError("evaluator returned no results"))
    assert not is_transient_error(
        httpx.HTTPStatusError("400", request=request, response=httpx.Response(400, request=request))
    )


async def test_execution_deadline_cancels_eval_and_counts_attempt(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        execution_deadline_seconds=0.01,
    )
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )
    hydrated = _hydrated_stub(results=[], evaluator_kind="BUILTIN", output_configs=[])
    cancelled = asyncio.Event()

    async def _hydrate(_: ClaimedWorkUnit) -> HydratedWorkUnit:
        return hydrated

    async def _never_resolves(*_: Any, **__: Any) -> None:
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
    monkeypatch.setattr(consumer._executor, "evaluate_and_annotate", _never_resolves)

    await consumer._process_unit(unit)

    assert cancelled.is_set()
    row = await _get_unit(db, unit_id)
    assert row.status == "ERROR"
    assert row.attempts == 1
    assert row.error is not None
    assert row.error.startswith("EVALUATOR_DEADLINE_EXCEEDED:")


async def test_llm_execution_deadline_retries_without_counting_attempt(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        execution_deadline_seconds=0.01,
    )
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )

    async def _hydrate(_: ClaimedWorkUnit) -> HydratedWorkUnit:
        return _hydrated_stub(results=[], evaluator_kind="LLM", output_configs=[])

    async def _never_resolves(*_: Any, **__: Any) -> None:
        await asyncio.Event().wait()

    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
    monkeypatch.setattr(consumer._executor, "evaluate_and_annotate", _never_resolves)

    await consumer._process_unit(unit)

    row = await _get_unit(db, unit_id)
    assert row.status == "ERROR"
    assert row.attempts == 0
    assert row.error is not None
    assert row.error.startswith("PROVIDER_DEADLINE_EXCEEDED:")


async def test_sandbox_payload_limit_is_terminal_without_counting_attempt(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )
    limit_error = SandboxPayloadTooLargeError("rendered payload exceeded its limit")

    async def _hydrate(_: ClaimedWorkUnit) -> HydratedWorkUnit:
        return _hydrated_stub(
            results=[
                _evaluation_result(
                    "criterion",
                    error=str(limit_error),
                    error_exc=limit_error,
                )
            ],
            evaluator_kind="CODE",
            output_configs=[_output_config("criterion")],
        )

    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)

    await consumer._process_unit(unit)

    row = await _get_unit(db, unit_id)
    assert row.status == "EXPIRED"
    assert row.attempts == 0
    assert row.error is not None
    assert row.error.startswith("SANDBOX_PAYLOAD_TOO_LARGE:")


async def test_process_cancellation_releases_claim_without_counting_attempt(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )
    started = asyncio.Event()

    async def _hydrate(_: ClaimedWorkUnit) -> HydratedWorkUnit:
        return _hydrated_stub(results=[], evaluator_kind="BUILTIN", output_configs=[])

    async def _never_resolves(*_: Any, **__: Any) -> None:
        started.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
    monkeypatch.setattr(consumer._executor, "evaluate_and_annotate", _never_resolves)
    task = asyncio.create_task(consumer._process_unit(unit))
    await started.wait()
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task

    row = await _get_unit(db, unit_id)
    assert row.status == "PENDING"
    assert row.attempts == 0
    assert row.claimed_by is None
    assert row.claimed_at is None


async def test_evaluator_queue_wait_renews_the_lease(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    monkeypatch.setattr(consumer_module, "HEARTBEAT_INTERVAL_SECONDS", 0.01)
    saturated = asyncio.Semaphore(1)
    await saturated.acquire()
    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluator_semaphore=saturated,
    )
    (unit,) = await consumer._coordinator.claim(claimed_by=consumer._consumer_id, limit=1)
    claimed_at = (await _get_unit(db, unit_id)).claimed_at
    heartbeated = asyncio.Event()
    coordinator_heartbeat = consumer._coordinator.heartbeat

    async def _heartbeat(**kwargs: Any) -> bool:
        renewed = await coordinator_heartbeat(**kwargs)
        heartbeated.set()
        return renewed

    monkeypatch.setattr(consumer._coordinator, "heartbeat", _heartbeat)

    queued = asyncio.create_task(consumer._acquire_with_heartbeat(unit, saturated))
    await asyncio.wait_for(heartbeated.wait(), timeout=5)
    saturated.release()
    await queued
    saturated.release()

    renewed_at = (await _get_unit(db, unit_id)).claimed_at
    assert claimed_at is not None and renewed_at is not None
    assert renewed_at > claimed_at


async def test_heartbeat_proceeds_under_db_semaphore_saturation(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    db_semaphore = asyncio.Semaphore(1)
    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        db_semaphore=db_semaphore,
    )
    (unit,) = await consumer._coordinator.claim(claimed_by=consumer._consumer_id, limit=1)
    claimed_at = (await _get_unit(db, unit_id)).claimed_at

    async with db_semaphore:
        assert await asyncio.wait_for(consumer._heartbeat(unit.work_unit_id), timeout=5)

    renewed_at = (await _get_unit(db, unit_id)).claimed_at
    assert claimed_at is not None and renewed_at is not None
    assert renewed_at > claimed_at


async def test_cycle_cancellation_during_batch_hydration_releases_claims(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        first_span = await _add_span(session, trace)
        second_span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_ids = [
        (await _materialize_unit(db, first_span.id, evaluator_id, criteria_id))[0],
        (await _materialize_unit(db, second_span.id, evaluator_id, criteria_id))[0],
    ]
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    hydrating = asyncio.Event()

    async def _never_resolves(*_: Any, **__: Any) -> None:
        hydrating.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(
        consumer._executor,
        "hydrate_configuration_snapshots",
        _never_resolves,
    )
    cycle = asyncio.create_task(consumer._cycle())
    await hydrating.wait()
    cycle.cancel()

    with pytest.raises(asyncio.CancelledError):
        await cycle

    for unit_id in unit_ids:
        row = await _get_unit(db, unit_id)
        assert row.status == "PENDING"
        assert row.attempts == 0
        assert row.claimed_by is None
        assert row.claimed_at is None


async def test_storage_pause_prevents_claiming_new_work(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    db.should_not_insert_or_update = True

    try:
        await consumer._cycle()
    finally:
        db.should_not_insert_or_update = False

    row = await _get_unit(db, unit_id)
    assert row.status == "PENDING"
    assert row.attempts == 0


async def test_storage_pause_before_publication_returns_claim_to_pending(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )

    async def _hydrate(_: ClaimedWorkUnit) -> HydratedWorkUnit:
        return _hydrated_stub(
            results=[_evaluation_result("criterion")],
            evaluator_kind="LLM",
            output_configs=[_output_config("criterion")],
        )

    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
    db.should_not_insert_or_update = True
    try:
        await consumer._process_unit(unit)
    finally:
        db.should_not_insert_or_update = False

    row = await _get_unit(db, unit_id)
    assert row.status == "PENDING"
    assert row.attempts == 0
    assert await _annotations(db) == []


async def test_shared_evaluator_limit_applies_across_target_consumers(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    shared_limit = asyncio.Semaphore(1)
    span_consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluator_semaphore=shared_limit,
    )
    session_consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluation_target="SESSION",
        evaluator_semaphore=shared_limit,
    )
    hydrated = _hydrated_stub(results=[], evaluator_kind="BUILTIN", output_configs=[])
    active = 0
    max_active = 0

    async def _hydrate(_: ClaimedWorkUnit) -> HydratedWorkUnit:
        return hydrated

    async def _evaluate(*_: Any, **__: Any) -> None:
        nonlocal active, max_active
        active += 1
        max_active = max(max_active, active)
        await asyncio.sleep(0)
        active -= 1

    async def _complete(**_: Any) -> bool:
        return True

    for consumer in (span_consumer, session_consumer):
        monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
        monkeypatch.setattr(consumer._executor, "evaluate_and_annotate", _evaluate)
        monkeypatch.setattr(consumer._coordinator, "complete", _complete)

    await asyncio.gather(
        span_consumer._process_unit(_claimed_unit(1, work_unit_id=1)),
        session_consumer._process_unit(
            _claimed_session_unit(1, identifier="online:session", work_unit_id=2)
        ),
    )

    assert max_active == 1


async def test_complete_retries_after_ambiguous_commit(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )
    hydrated = _hydrated_stub(results=[], evaluator_kind="BUILTIN", output_configs=[])

    async def _hydrate(_: ClaimedWorkUnit) -> HydratedWorkUnit:
        return hydrated

    async def _evaluate(*_: Any, **__: Any) -> None:
        return None

    original_complete = consumer._coordinator.complete
    complete_calls = 0

    async def _ambiguous_complete(**kwargs: Any) -> bool:
        nonlocal complete_calls
        complete_calls += 1
        completed = await original_complete(**kwargs)
        if complete_calls == 1:
            raise ConnectionError("commit acknowledgement lost")
        return completed

    monkeypatch.setattr(consumer_module, "_TRANSITION_RETRY_DELAYS_SECONDS", (0.0, 0.0, 0.0))
    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
    monkeypatch.setattr(consumer._executor, "evaluate_and_annotate", _evaluate)
    monkeypatch.setattr(consumer._coordinator, "complete", _ambiguous_complete)

    await consumer._process_unit(unit)

    assert complete_calls == 1
    assert (await _get_unit(db, unit_id)).status == "DONE"


async def test_failure_transition_retries_raised_exceptions(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )
    hydrated = _hydrated_stub(results=[], evaluator_kind="BUILTIN", output_configs=[])

    async def _hydrate(_: ClaimedWorkUnit) -> HydratedWorkUnit:
        return hydrated

    async def _evaluate(*_: Any, **__: Any) -> None:
        raise ValueError("bad evaluator")

    original_fail = consumer._coordinator.fail
    original_heartbeat = consumer._coordinator.heartbeat
    fail_calls = 0
    heartbeat_calls = 0

    async def _flaky_fail(**kwargs: Any) -> bool:
        nonlocal fail_calls
        fail_calls += 1
        if fail_calls <= 3:
            raise ConnectionError("database unavailable")
        return await original_fail(**kwargs)

    async def _heartbeat(**kwargs: Any) -> bool:
        nonlocal heartbeat_calls
        heartbeat_calls += 1
        return await original_heartbeat(**kwargs)

    monkeypatch.setattr(consumer_module, "_TRANSITION_RETRY_DELAYS_SECONDS", (0.0, 0.0, 0.0))
    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
    monkeypatch.setattr(consumer._executor, "evaluate_and_annotate", _evaluate)
    monkeypatch.setattr(consumer._coordinator, "fail", _flaky_fail)
    monkeypatch.setattr(consumer._coordinator, "heartbeat", _heartbeat)

    await consumer._process_unit(unit)

    assert fail_calls == 4
    assert heartbeat_calls == 3
    row = await _get_unit(db, unit_id)
    assert row.status == "ERROR"
    assert row.attempts == 1


async def test_failure_transition_retries_after_ambiguous_commit(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    (unit,) = await consumer._coordinator.claim(
        claimed_by=consumer._consumer_id,
        limit=1,
    )

    async def _hydrate(_: ClaimedWorkUnit) -> HydratedWorkUnit:
        return _hydrated_stub(results=[], evaluator_kind="BUILTIN", output_configs=[])

    async def _evaluate(*_: Any, **__: Any) -> None:
        raise ValueError("bad evaluator")

    original_fail = consumer._coordinator.fail
    fail_calls = 0

    async def _ambiguous_fail(**kwargs: Any) -> bool:
        nonlocal fail_calls
        fail_calls += 1
        failed = await original_fail(**kwargs)
        if fail_calls == 1:
            raise ConnectionError("commit acknowledgement lost")
        return failed

    monkeypatch.setattr(consumer_module, "_TRANSITION_RETRY_DELAYS_SECONDS", (0.0, 0.0, 0.0))
    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
    monkeypatch.setattr(consumer._executor, "evaluate_and_annotate", _evaluate)
    monkeypatch.setattr(consumer._coordinator, "fail", _ambiguous_fail)

    await consumer._process_unit(unit)

    assert fail_calls == 1
    row = await _get_unit(db, unit_id)
    assert row.status == "ERROR"
    assert row.attempts == 1


async def test_staleness_guard_expires_unit_without_annotating(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)

    # A criteria edit between materialization and consumption changes the
    # recomputed fingerprint, so the unit must be dropped, not executed.
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluatorCriteria)
            .where(models.ProjectEvaluatorCriteria.id == criteria_id)
            .values(sampling_rate=0.5)
        )

    consumer = OnlineEvalConsumer(db, decrypt=lambda b: b)
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "EXPIRED"
    assert unit.error == "CONFIG_FINGERPRINT_MISMATCH"
    assert await _annotations(db) == []


async def test_stop_drains_in_flight_work_instead_of_cancelling(
    db: DbSessionFactory,
) -> None:
    consumer = OnlineEvalConsumer(db, decrypt=lambda b: b)
    finished = asyncio.Event()

    async def _in_flight() -> None:
        await asyncio.sleep(0.05)
        finished.set()

    await consumer.start()
    task = asyncio.create_task(_in_flight())
    consumer._pending_tasks.add(task)
    task.add_done_callback(consumer._pending_tasks.discard)

    await consumer.stop()

    assert finished.is_set()
    assert not task.cancelled()


async def test_stop_cancels_and_awaits_work_past_drain_timeout(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(consumer_module, "DRAIN_TIMEOUT_SECONDS", 0.01)
    consumer = OnlineEvalConsumer(db, decrypt=lambda value: value)
    started = asyncio.Event()
    cancellation_finished = asyncio.Event()

    async def _in_flight() -> None:
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            await asyncio.sleep(0)
            cancellation_finished.set()

    task = asyncio.create_task(_in_flight())
    consumer._pending_tasks.add(task)
    task.add_done_callback(consumer._pending_tasks.discard)
    await started.wait()

    await consumer.stop()

    assert task.cancelled()
    assert cancellation_finished.is_set()


async def test_disabled_criteria_expires_unit(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(db, project.id)
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)

    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluatorCriteria)
            .where(models.ProjectEvaluatorCriteria.id == criteria_id)
            .values(enabled=False)
        )

    consumer = OnlineEvalConsumer(db, decrypt=lambda b: b)
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "EXPIRED"
    assert unit.error == "CRITERIA_DISABLED"
    assert await _annotations(db) == []


async def test_session_stand_down_is_visible_on_the_expired_gauge(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Deleting session content retires its evaluations by expiring them, so the
    expired gauge is the only place an operator sees evaluations being dropped.
    """
    monkeypatch.setattr(consumer_module, "get_env_enable_prometheus", lambda: True)
    expired_gauge = Mock()
    monkeypatch.setattr(consumer_module, "ONLINE_EVAL_EXPIRED_WORK_UNITS", expired_gauge)

    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_builtin_criteria(
        db,
        project.id,
        evaluation_target="SESSION",
    )
    unit_id, _ = await _materialize_session_unit(
        db,
        project_session.id,
        evaluator_id,
        criteria_id,
    )
    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_id)
            .values(status="EXPIRED", error=SESSION_CONTENT_INCOMPLETE_ERROR)
        )

    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluation_target="SESSION",
    )
    await consumer._publish_queue_metrics()

    expired_gauge.labels.assert_called_once_with(evaluation_target="SESSION")
    expired_gauge.labels.return_value.set.assert_called_once_with(1)
