import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from queue import SimpleQueue
from secrets import token_hex
from typing import Any, AsyncIterator, Optional, Sequence, cast

import httpx
import pytest
from sqlalchemy import select, update
from sqlalchemy.orm import with_polymorphic

from phoenix.db import models
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
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    FunctionCallChunk,
    ToolCallChunk,
)
from phoenix.server.dml_event import (
    DmlEvent,
    ProjectSessionAnnotationInsertEvent,
    SpanAnnotationInsertEvent,
)
from phoenix.server.online_eval import consumer as consumer_module
from phoenix.server.online_eval import executor as executor_module
from phoenix.server.online_eval.consumer import (
    EvalExecutionTimeout,
    OnlineEvalConsumer,
    is_transient_error,
)
from phoenix.server.online_eval.coordinator import LEASE_TTL_SECONDS, ClaimedWorkUnit
from phoenix.server.online_eval.db_coordinator import DbEvalWorkCoordinator
from phoenix.server.online_eval.derivation import annotation_identifier, config_fingerprint
from phoenix.server.online_eval.executor import (
    EvalExecutionError,
    HydratedWorkUnit,
    OnlineEvalExecutor,
    session_eval_context,
    span_eval_context,
)
from phoenix.server.online_eval.producer import resolve_criteria
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


def _patch_playground_client(monkeypatch: pytest.MonkeyPatch, client: _StubLLMClient) -> None:
    async def _get_client(**_: Any) -> _StubLLMClient:
        return client

    monkeypatch.setattr("phoenix.server.online_eval.executor.get_playground_client", _get_client)


class _StubSandboxBackend:
    secret_values: tuple[str, ...] = ()


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
) -> HydratedWorkUnit:
    return HydratedWorkUnit(
        annotation_name=annotation_name,
        annotator_kind="LLM" if evaluator_kind == "LLM" else "CODE",
        evaluator_kind=cast(Any, evaluator_kind),
        evaluator=cast(Any, _StubEvaluator(results)),
        input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        output_configs=output_configs,
        context={},
    )


def _claimed_unit(target_rowid: int, *, work_unit_id: int = 1) -> ClaimedWorkUnit:
    now = datetime.now(timezone.utc)
    return ClaimedWorkUnit(
        work_unit_id=work_unit_id,
        evaluation_target="SPAN",
        target_rowid=target_rowid,
        generation=None,
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
        generation=0,
        evaluator_id=1,
        criteria_id=1,
        config_fingerprint="fingerprint",
        identifier=identifier,
        attempts=0,
        claimed_by="consumer",
        lease_expires_at=now + timedelta(seconds=LEASE_TTL_SECONDS),
    )


async def _seed_llm_criteria(
    db: DbSessionFactory,
    project_id: int,
    *,
    template_content: str = "Input: {{input}}\n\nOutput: {{output}}\n\nGood?",
    criteria_input_mapping: Optional[InputMapping] = None,
    evaluation_target: models.EvaluationTarget = "SPAN",
) -> tuple[int, int]:
    """Create an LLM evaluator (prompt + version + tools) and an enabled criteria
    row, returning (evaluator_id, criteria_id)."""
    async with db() as session:
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
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
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
    *,
    generation: int = 0,
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
        resolved = await resolve_criteria(session, criteria, evaluator)
        assert resolved is not None
        fingerprint = config_fingerprint(resolved)
        unit = models.EvalSessionWorkUnit(
            project_session_rowid=project_session_rowid,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=fingerprint,
            generation=generation,
        )
        session.add(unit)
        await session.flush()
        return unit.id, fingerprint


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
        session_id="session-1",
        turns=turns,
        num_traces=4,
        duration_seconds=12.5,
        token_count_total=123,
        max_transcript_bytes=len(expected_transcript.encode("utf-8")),
    )

    assert set(context) == {
        "input",
        "output",
        "last_output",
        "first_input",
        "turns",
        "session_id",
        "metadata",
        "num_traces",
        "duration_seconds",
        "token_count_total",
    }
    assert context["input"] == expected_transcript
    assert len(context["input"].encode("utf-8")) <= len(expected_transcript.encode("utf-8"))
    assert context["turns"] == turns
    assert context["first_input"] == turns[0]["input"]
    assert context["last_output"] == turns[-1]["output"]
    assert context["output"] == turns[-1]["output"]
    assert context["session_id"] == "session-1"
    assert context["metadata"] == {"session_id": "session-1"}
    assert context["num_traces"] == 4
    assert context["duration_seconds"] == 12.5
    assert context["token_count_total"] == 123

    omitted_turn = {"input": "x" * 500, "output": "y" * 500, "metadata": {}}
    omitted_transcript = f"User: {omitted_turn['input']}\nAssistant: {omitted_turn['output']}"
    with pytest.raises(EvalExecutionError) as exc_info:
        session_eval_context(
            session_id="session-1",
            turns=[omitted_turn],
            num_traces=1,
            duration_seconds=0.0,
            token_count_total=0,
            max_transcript_bytes=256,
        )
    error = str(exc_info.value)
    assert f"{len(omitted_transcript.encode('utf-8'))} bytes" in error
    assert "256-byte cap" in error
    assert "PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES" in error
    assert "Raise" in error

    null_values = session_eval_context(
        session_id="null-session",
        turns=[{"input": None, "output": None, "metadata": {"raw": True}}],
        num_traces=1,
        duration_seconds=0.0,
        token_count_total=0,
        max_transcript_bytes=256,
    )
    assert null_values["input"] == "User: \nAssistant: "
    assert null_values["first_input"] is None
    assert null_values["last_output"] is None
    assert null_values["turns"] == [{"input": None, "output": None, "metadata": {"raw": True}}]

    empty = session_eval_context(
        session_id="empty-session",
        turns=[],
        num_traces=1,
        duration_seconds=0.0,
        token_count_total=0,
        max_transcript_bytes=256,
    )
    assert empty["input"] == ""
    assert empty["output"] is None
    assert empty["last_output"] is None
    assert empty["first_input"] is None
    assert empty["turns"] == []


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


async def test_session_happy_path_builds_context_annotates_and_emits_insert_event(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(executor_module, "_MAX_SESSION_EVAL_TURNS", 2)
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
            attributes={
                "input": {"value": "second question"},
                "output": {"value": "second answer"},
                "metadata": {"turn": 2},
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
            "{{input}}\nLAST={{last_output}}\nFIRST={{first_input}}\n"
            "COUNT={{num_traces}}\nDURATION={{duration_seconds}}\n"
            "TOKENS={{token_count_total}}\n"
            "TURNS={{#turns}}{{input}}/{{output}}/{{metadata.turn}};{{/turns}}"
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
        "LAST=second answer\nFIRST=first question\nCOUNT=4\n"
        "DURATION=90.0\nTOKENS=18\n"
        "TURNS=first question/first answer/1;second question/second answer/2;"
    )
    (annotation,) = await _session_annotations(db)
    assert annotation.project_session_id == project_session.id
    assert annotation.label == "good"
    assert annotation.score == 1.0
    assert annotation.explanation == "looks good"
    assert annotation.annotator_kind == "LLM"
    assert annotation.source == "API"
    assert annotation.identifier == annotation_identifier(fingerprint, 0)
    assert events.get_nowait() == ProjectSessionAnnotationInsertEvent((annotation.id,))
    assert events.empty()

    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        annotation_name = criteria.name.root
    duplicate = _claimed_session_unit(
        project_session.id,
        identifier=annotation_identifier(fingerprint, 0),
        work_unit_id=unit_id,
    )
    duplicate_hydrated = _hydrated_stub(
        results=[_evaluation_result(annotation_name)],
        evaluator_kind="LLM",
        output_configs=[_output_config("quality")],
        annotation_name=annotation_name,
    )
    await consumer._executor.evaluate_and_annotate(duplicate, duplicate_hydrated)
    assert len(await _session_annotations(db)) == 1
    assert events.empty()


async def test_session_generation_above_zero_expires_before_evaluator_call(
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
        generation=1,
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
    assert await consumer._executor.hydrate(unit) is None
    await consumer._process_unit(unit)

    assert (await _get_session_unit(db, unit_id)).status == "EXPIRED"
    assert client.requests == []
    assert await _session_annotations(db) == []


async def test_marker_only_session_transcript_counts_attempt_without_evaluation(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    input_value = "x" * 500
    output_value = "y" * 500
    transcript = f"User: {input_value}\nAssistant: {output_value}"
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
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES", "256")

    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        evaluation_target="SESSION",
    )
    await consumer._cycle()

    unit = await _get_session_unit(db, unit_id)
    assert unit.status == "ERROR"
    assert unit.attempts == 1
    assert unit.error is not None
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
    assert await consumer._executor.hydrate(unit) is None
    await consumer._process_unit(unit)

    assert (await _get_session_unit(db, unit_id)).status == "EXPIRED"
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
    assert await consumer._executor.hydrate(unit) is None
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
    executor = OnlineEvalExecutor(
        db,
        decrypt=lambda value: value,
        sandbox_session_manager=cast(Any, manager),
    )

    hydrated = await executor.hydrate(unit)

    assert hydrated is not None
    assert captured_runner_arguments["max_payload_bytes"] == 2048
    assert (
        captured_runner_arguments["payload_limit_remediation"]
        == "Reduce the mapped session inputs or raise the limit with "
        "PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES."
    )


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
    executor = OnlineEvalExecutor(
        db,
        decrypt=lambda value: value,
        sandbox_session_manager=cast(Any, manager),
    )
    hydrated = await executor.hydrate(unit)
    assert hydrated is not None

    await executor.evaluate_and_annotate(unit, hydrated)

    (executed_code,) = manager.session.executed_code
    assert "mapped context" in executed_code
    assert "criteria literal" in executed_code
    assert "evaluator default" not in executed_code
    assert manager.session_keys == [f"online-eval:{evaluator_id}:test-replica"]
    annotation = (await _annotations(db))[0]
    assert annotation.score == 0.75


@pytest.mark.parametrize(
    ("configuration_state", "error_message"),
    [
        ("missing", "has no sandbox config"),
        ("disabled", "is missing or disabled"),
        ("provider_disabled", "sandbox provider 'WASM' is missing or disabled"),
    ],
)
async def test_code_hydration_configuration_failure_counts_attempt(
    db: DbSessionFactory,
    configuration_state: str,
    error_message: str,
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
    unit_id, _ = await _materialize_unit(db, span.id, evaluator_id, criteria_id)

    consumer = OnlineEvalConsumer(
        db,
        decrypt=lambda value: value,
        sandbox_session_manager=cast(Any, _StubSandboxSessionManager()),
    )
    await consumer._cycle()

    unit = await _get_unit(db, unit_id)
    assert unit.status == "ERROR"
    assert unit.attempts == 1
    assert unit.error is not None
    assert error_message in unit.error
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
    executor = OnlineEvalExecutor(db, decrypt=lambda b: b, event_queue=events)
    first_hydrated = await executor.hydrate(first_claim)
    reclaimed_hydrated = await executor.hydrate(reclaimed)
    assert first_hydrated is not None
    assert reclaimed_hydrated is not None

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
    executor = OnlineEvalExecutor(db, decrypt=lambda value: value)

    with pytest.raises(EvalExecutionError, match="incomplete result set"):
        await executor.evaluate_and_annotate(_claimed_unit(span.id), hydrated)

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
    executor = OnlineEvalExecutor(db, decrypt=lambda value: value)

    with pytest.raises(EvalExecutionError, match="second output failed") as exc_info:
        await executor.evaluate_and_annotate(_claimed_unit(span.id), hydrated)

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
    executor = OnlineEvalExecutor(db, decrypt=lambda value: value)

    await executor.evaluate_and_annotate(_claimed_unit(span.id), hydrated)

    annotations = await _annotations(db)
    assert {annotation.name for annotation in annotations} == {
        "criterion.quality",
        "criterion.relevance",
    }


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

    classified: list[BaseException] = []

    def _classify(exc: BaseException) -> bool:
        classified.append(exc)
        return is_transient_error(exc)

    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
    monkeypatch.setattr(consumer._executor, "evaluate_and_annotate", _never_resolves)
    monkeypatch.setattr(consumer_module, "is_transient_error", _classify)

    await consumer._process_unit(unit)

    assert cancelled.is_set()
    assert len(classified) == 1
    timeout = classified[0]
    assert isinstance(timeout, EvalExecutionTimeout)
    assert timeout.__cause__ is None
    assert timeout.__suppress_context__
    assert not is_transient_error(timeout)
    row = await _get_unit(db, unit_id)
    assert row.status == "ERROR"
    assert row.attempts == 1


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

    assert complete_calls == 2
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
    fail_calls = 0

    async def _flaky_fail(**kwargs: Any) -> bool:
        nonlocal fail_calls
        fail_calls += 1
        if fail_calls <= 3:
            raise ConnectionError("database unavailable")
        return await original_fail(**kwargs)

    monkeypatch.setattr(consumer_module, "_TRANSITION_RETRY_DELAYS_SECONDS", (0.0, 0.0, 0.0))
    monkeypatch.setattr(consumer._executor, "hydrate", _hydrate)
    monkeypatch.setattr(consumer._executor, "evaluate_and_annotate", _evaluate)
    monkeypatch.setattr(consumer._coordinator, "fail", _flaky_fail)

    await consumer._process_unit(unit)

    assert fail_calls == 4
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

    assert fail_calls == 2
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
    assert await _annotations(db) == []
