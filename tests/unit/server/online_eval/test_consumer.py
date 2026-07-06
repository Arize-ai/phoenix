import asyncio
from datetime import datetime, timezone
from secrets import token_hex
from typing import Any, AsyncIterator, Optional

import pytest
from sqlalchemy import select, update
from sqlalchemy.orm import with_polymorphic

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    OptimizationDirection,
)
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
from phoenix.server.online_eval.consumer import OnlineEvalConsumer
from phoenix.server.online_eval.derivation import annotation_identifier, config_fingerprint
from phoenix.server.online_eval.producer import resolve_criteria
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_span, _add_trace


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

    async def chat_completion_create(self, **_: Any) -> AsyncIterator[Any]:
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


async def _seed_llm_criteria(db: DbSessionFactory, project_id: int) -> tuple[int, int]:
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
                                content="Input: {{input}}\n\nOutput: {{output}}\n\nGood?",
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
        )
        session.add(criteria)
        await session.flush()
        return evaluator.id, criteria.id


async def _seed_builtin_criteria(db: DbSessionFactory, project_id: int) -> tuple[int, int]:
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


async def _get_unit(db: DbSessionFactory, unit_id: int) -> models.EvalWorkUnit:
    async with db() as session:
        unit = await session.get(models.EvalWorkUnit, unit_id)
        assert unit is not None
        return unit


async def _annotations(db: DbSessionFactory) -> list[models.SpanAnnotation]:
    async with db() as session:
        return list(await session.scalars(select(models.SpanAnnotation)))


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
