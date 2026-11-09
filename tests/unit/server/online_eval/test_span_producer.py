import asyncio
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock

import pytest
from sqlalchemy import delete, select, update

from phoenix.db import models
from phoenix.db.eval_work import MAX_ATTEMPTS
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    OptimizationDirection,
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
)
from phoenix.server.api.routers.agents import (
    _emit_turn_root_span,
    _persist_db_traces,
    _resolve_turn_trace_ids,
)
from phoenix.server.encryption import EncryptionService
from phoenix.server.evaluators.runtime.builtin import ContainsEvaluator
from phoenix.server.evaluators.services.project_bindings import (
    ProjectEvaluatorPatch,
    apply_project_evaluator_patch,
)
from phoenix.server.online_eval import span_producer as span_producer_module
from phoenix.server.online_eval.derivation import ResolvedProjectEvaluator, config_fingerprint
from phoenix.server.online_eval.leases import SCAN_LEASE_TTL_SECONDS
from phoenix.server.online_eval.project_evaluator_resolution import (
    resolve_project_evaluators_bulk,
)
from phoenix.server.online_eval.span_producer import SpanEvaluationProducer
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer

from ..._helpers import _add_project, _add_span, _add_trace


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _seed_criteria(
    db: DbSessionFactory,
    project_id: int,
    *,
    filter_condition: str = "",
    sampling_rate: float = 1.0,
    evaluation_target: models.EvaluationTarget = "SPAN",
) -> tuple[int, int]:
    """Create a builtin evaluator and a project_evaluator row, returning
    (evaluator_id, project_evaluator_id)."""
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
        project_evaluator = models.ProjectEvaluator(
            trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
            project_id=project_id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
            filter_condition=filter_condition,
            sampling_rate=sampling_rate,
            evaluation_target=evaluation_target,
        )
        session.add(project_evaluator)
        await session.flush()
        return evaluator.id, project_evaluator.id


async def _seed_code_criteria(
    db: DbSessionFactory,
    project_id: int,
    *,
    evaluator_input_mapping: InputMapping = InputMapping(literal_mapping={}, path_mapping={}),
    evaluation_target: models.EvaluationTarget = "SPAN",
) -> tuple[int, int, int]:
    async with db() as session:
        if await session.get(models.Language, "PYTHON") is None:
            session.add(models.Language(name="PYTHON"))
        if await session.get(models.SandboxProvider, "WASM") is None:
            session.add(models.SandboxProvider(backend_type="WASM", enabled=True, config={}))
        await session.flush()
        sandbox_config = models.SandboxConfig(
            backend_type="WASM",
            language="PYTHON",
            name=Identifier(root=f"sandbox-{token_hex(4)}"),
            description=None,
            config={},
            timeout=30,
        )
        evaluator = models.CodeEvaluator(
            name=Identifier(root=f"code-{token_hex(4)}"),
            description=None,
            kind="CODE",
            language="PYTHON",
            sandbox_config=sandbox_config,
            input_mapping=evaluator_input_mapping,
            output_configs=[],
            versions=[models.CodeEvaluatorVersion(source_code="def evaluate(): return 1")],
        )
        session.add(evaluator)
        await session.flush()
        project_evaluator = models.ProjectEvaluator(
            trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
            project_id=project_id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target=evaluation_target,
        )
        session.add(project_evaluator)
        await session.flush()
        return evaluator.id, project_evaluator.id, sandbox_config.id


async def _seed_cursor(db: DbSessionFactory, *, produced_through_id: int = 0) -> None:
    async with db() as session:
        session.add(models.EvalSpanCursor(id=1, produced_through_id=produced_through_id))


async def _observed_producer(db: DbSessionFactory, **kwargs: Any) -> SpanEvaluationProducer:
    """A producer with no visibility lag that has run the tick that sees the high water, so
    its next tick scans up to it."""
    producer = SpanEvaluationProducer(db, visibility_lag_seconds=0, **kwargs)
    await producer._tick()
    return producer


async def _get_cursor(db: DbSessionFactory) -> models.EvalSpanCursor:
    async with db() as session:
        cursor = await session.get(models.EvalSpanCursor, 1)
        assert cursor is not None
        return cursor


async def _work_unit_span_rowids(db: DbSessionFactory) -> list[int]:
    async with db() as session:
        return list(await session.scalars(select(models.EvalWorkUnit.span_rowid)))


async def test_cold_start_initializes_cursor_at_current_high_water(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(3)]
    await _seed_criteria(db, project.id)

    producer = SpanEvaluationProducer(db)
    await producer._tick()

    async with db() as session:
        cursor = (await session.scalars(select(models.EvalSpanCursor))).one()
        lease = (await session.scalars(select(models.EvalWorkLease))).one()
    assert cursor.produced_through_id == spans[-1].id
    assert lease.holder == producer._lease.holder
    assert await _work_unit_span_rowids(db) == []


async def test_storage_pause_skips_scanning_and_cursor_advance(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(db)
    producer = await _observed_producer(db)
    db.should_not_insert_or_update = True

    try:
        await producer._tick()
    finally:
        db.should_not_insert_or_update = False

    assert await _work_unit_span_rowids(db) == []
    assert (await _get_cursor(db)).produced_through_id == 0


async def test_tick_queues_matching_spans_and_advances_the_cursor(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        llm_spans = [await _add_span(session, trace, span_kind="LLM") for _ in range(3)]
        tool_span = await _add_span(session, trace, span_kind="TOOL")
        other_project = await _add_project(session)
        other_trace = await _add_trace(session, other_project)
        other_span = await _add_span(session, other_trace, span_kind="LLM")
    _, project_evaluator_id = await _seed_criteria(
        db, project.id, filter_condition="span_kind == 'LLM'"
    )
    high_water = other_span.id
    await _seed_cursor(db)

    producer = await _observed_producer(db)
    await producer._tick()

    queued = await _work_unit_span_rowids(db)
    assert sorted(queued) == sorted(span.id for span in llm_spans)
    assert tool_span.id not in queued
    assert other_span.id not in queued

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    for unit in units:
        assert unit.status == "PENDING"
        assert unit.project_evaluator_id == project_evaluator_id

    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == high_water

    # Re-scanning the same window is idempotent under the work-key unique constraint.
    async with db() as session:
        await session.execute(update(models.EvalSpanCursor).values(produced_through_id=0))
    await producer._tick()
    assert len(await _work_unit_span_rowids(db)) == len(llm_spans)


async def test_tick_queues_nothing_for_a_deleted_project_evaluator(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace, span_kind="LLM")
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(deleted_at=_now())
        )
    await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    await SpanEvaluationProducer(db)._tick()

    assert await _work_unit_span_rowids(db) == []


async def test_tick_queues_a_root_span_persisted_by_pxi(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
    await _seed_criteria(db, project.id, filter_condition="parent_id is None")
    now = _now()
    tracer = Tracer(span_cost_calculator=Mock())
    _emit_turn_root_span(
        tracer=tracer,
        turn_ids=_resolve_turn_trace_ids(None, now=now),
        session_id="pxi-session",
        input_text="Summarize this trace",
        output_text="Done",
        error_message=None,
        end_time=now,
        user_email=None,
    )
    async with db() as session:
        await _persist_db_traces(
            session=session, db_traces=tracer.get_db_traces(project_id=project.id)
        )
    async with db() as session:
        root_span_rowid = await session.scalar(
            select(models.Span.id).where(models.Span.parent_id.is_(None))
        )
    assert root_span_rowid is not None
    await _seed_cursor(db)

    await (await _observed_producer(db))._tick()

    assert await _work_unit_span_rowids(db) == [root_span_rowid]


async def test_builtin_implementation_version_changes_fingerprint(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        # The test database is seeded with the app's startup rows, which include
        # the synced builtin evaluators; reuse that row rather than insert a
        # second `contains` (evaluators.name is unique).
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
                synced_at=_now(),
            )
            session.add(evaluator)
            await session.flush()
        project_evaluator = models.ProjectEvaluator(
            trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root="project_evaluator"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(project_evaluator)
        await session.flush()

        first = (await resolve_project_evaluators_bulk(session, [(project_evaluator, evaluator)]))[
            0
        ]
        assert first is not None
        monkeypatch.setattr(ContainsEvaluator, "implementation_version", "2")
        second = (await resolve_project_evaluators_bulk(session, [(project_evaluator, evaluator)]))[
            0
        ]
        assert second is not None

    assert config_fingerprint(first) != config_fingerprint(second)


async def test_llm_custom_provider_edit_changes_fingerprint(
    db: DbSessionFactory,
) -> None:
    """A custom provider's connection config decides what actually answers the evaluation,
    so editing it must move the fingerprint even though the prompt version is unchanged."""
    async with db() as session:
        project = await _add_project(session)
        provider = models.GenerativeModelCustomProvider(
            name=f"provider-{token_hex(4)}",
            provider="openai",
            sdk="OPENAI",
            config=EncryptionService().encrypt(b'{"base_url": "https://vendor.example"}'),
        )
        session.add(provider)
        await session.flush()

        prompt = models.Prompt(
            name=Identifier(root=f"prompt-{token_hex(4)}"),
            description=None,
            prompt_versions=[
                models.PromptVersion(
                    template_type=PromptTemplateType.CHAT,
                    template_format=PromptTemplateFormat.MUSTACHE,
                    template=PromptChatTemplate(
                        type="chat",
                        messages=[PromptMessage(role="user", content="Good? {{output}}")],
                    ),
                    invocation_parameters=PromptOpenAIInvocationParameters(
                        type="openai", openai=PromptOpenAIInvocationParametersContent()
                    ),
                    tools=None,
                    response_format=None,
                    model_provider=ModelProvider.OPENAI,
                    model_name="gpt-4",
                    metadata_={},
                    custom_provider_id=provider.id,
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
        project_evaluator = models.ProjectEvaluator(
            trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(project_evaluator)
        await session.flush()

        before = (await resolve_project_evaluators_bulk(session, [(project_evaluator, evaluator)]))[
            0
        ]
        assert before is not None

        # Repoint the provider at a different endpoint. The prompt version — and so the
        # pre-fix version_ref — is untouched.
        provider.config = EncryptionService().encrypt(b'{"base_url": "https://self.hosted"}')
        provider.updated_at = _now() + timedelta(minutes=1)
        await session.flush()

        after = (await resolve_project_evaluators_bulk(session, [(project_evaluator, evaluator)]))[
            0
        ]
        assert after is not None

    assert config_fingerprint(before) != config_fingerprint(after)


async def test_unregistered_builtin_cannot_resolve_criteria(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root="unregistered"),
            kind="BUILTIN",
            key="unregistered",
            input_schema={},
            output_configs=[],
            synced_at=_now(),
        )
        session.add(evaluator)
        await session.flush()
        project_evaluator = models.ProjectEvaluator(
            trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root="project_evaluator"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(project_evaluator)
        await session.flush()

        assert (await resolve_project_evaluators_bulk(session, [(project_evaluator, evaluator)]))[
            0
        ] is None


async def test_code_criteria_input_mapping_falls_back_to_the_evaluators(
    db: DbSessionFactory,
) -> None:
    """A binding with no input_mapping override inherits the evaluator's own mapping,
    not an empty one, so deleting the fallback in resolve_project_evaluator fails here."""
    evaluator_mapping = InputMapping(
        literal_mapping={"key": "value"}, path_mapping={"output": "$.output"}
    )
    async with db() as session:
        project = await _add_project(session)
    evaluator_id, project_evaluator_id, _ = await _seed_code_criteria(
        db, project.id, evaluator_input_mapping=evaluator_mapping
    )

    async with db() as session:
        evaluator = await session.get(models.CodeEvaluator, evaluator_id)
        project_evaluator = await session.get(models.ProjectEvaluator, project_evaluator_id)
        assert evaluator is not None
        assert project_evaluator is not None
        assert project_evaluator.input_mapping is None
        resolved = (
            await resolve_project_evaluators_bulk(session, [(project_evaluator, evaluator)])
        )[0]
        assert resolved is not None
        assert resolved.input_mapping == evaluator_mapping.model_dump()


async def test_sandbox_runtime_changes_code_criteria_fingerprint(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
    evaluator_id, project_evaluator_id, sandbox_config_id = await _seed_code_criteria(
        db, project.id
    )

    async with db() as session:
        evaluator = await session.get(models.CodeEvaluator, evaluator_id)
        project_evaluator = await session.get(models.ProjectEvaluator, project_evaluator_id)
        sandbox_config = await session.get(models.SandboxConfig, sandbox_config_id)
        assert evaluator is not None
        assert project_evaluator is not None
        assert sandbox_config is not None
        first = (await resolve_project_evaluators_bulk(session, [(project_evaluator, evaluator)]))[
            0
        ]
        assert first is not None
        sandbox_config.timeout += 1
        sandbox_config.updated_at = _now() + timedelta(seconds=1)
        await session.flush()
        second = (await resolve_project_evaluators_bulk(session, [(project_evaluator, evaluator)]))[
            0
        ]
        assert second is not None

    assert config_fingerprint(first) != config_fingerprint(second)


async def test_disabled_sandbox_runtime_does_not_resolve_code_criteria(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
    evaluator_id, project_evaluator_id, sandbox_config_id = await _seed_code_criteria(
        db, project.id
    )

    async with db() as session:
        evaluator = await session.get(models.CodeEvaluator, evaluator_id)
        project_evaluator = await session.get(models.ProjectEvaluator, project_evaluator_id)
        sandbox_config = await session.get(models.SandboxConfig, sandbox_config_id)
        assert evaluator is not None
        assert project_evaluator is not None
        assert sandbox_config is not None
        sandbox_config.enabled = False
        await session.flush()

        assert (await resolve_project_evaluators_bulk(session, [(project_evaluator, evaluator)]))[
            0
        ] is None


async def test_active_criteria_are_bulk_resolved_once(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_id = project.id
    for _ in range(3):
        await _seed_criteria(db, project_id)

    call_sizes: list[int] = []

    async def _counting_resolver(
        *args: Any, **kwargs: Any
    ) -> list[ResolvedProjectEvaluator | None]:
        call_sizes.append(len(args[1]))
        return await resolve_project_evaluators_bulk(*args, **kwargs)

    monkeypatch.setattr(span_producer_module, "resolve_project_evaluators_bulk", _counting_resolver)

    active = await SpanEvaluationProducer(db)._load_active_project_evaluators()

    assert len(active) == 3
    assert call_sizes == [3]


@pytest.mark.parametrize("evaluation_target", ["TRACE", "SESSION"])
async def test_future_targets_are_not_loaded_by_span_producer(
    db: DbSessionFactory,
    evaluation_target: models.EvaluationTarget,
) -> None:
    async with db() as session:
        project = await _add_project(session)
    await _seed_criteria(db, project.id, evaluation_target=evaluation_target)

    producer = SpanEvaluationProducer(db)

    assert await producer._load_active_project_evaluators() == []


async def test_tick_advances_at_most_one_id_chunk(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(5)]
    await _seed_criteria(db, project.id)
    low_exclusive = spans[0].id - 1
    await _seed_cursor(db, produced_through_id=low_exclusive)

    producer = await _observed_producer(db, max_span_ids_per_tick=2)
    assert await producer._tick() is True

    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == low_exclusive + 2
    assert sorted(await _work_unit_span_rowids(db)) == [span.id for span in spans[:2]]

    assert await producer._tick() is True

    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == low_exclusive + 4
    assert sorted(await _work_unit_span_rowids(db)) == [span.id for span in spans[:4]]

    assert await producer._tick() is False
    assert (await _get_cursor(db)).produced_through_id == spans[-1].id


async def test_waiting_work_does_not_stop_the_span_producer_queuing_new_spans(
    db: DbSessionFactory,
) -> None:
    """Overload shows as waiting work, never as a producer that fell behind."""
    window = 5
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        backlog = [await _add_span(session, trace) for _ in range(2 * window)]
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    async with db() as session:
        session.add_all(
            models.EvalWorkUnit(span_rowid=span.id, project_evaluator_id=project_evaluator_id)
            for span in backlog
        )
    producer = SpanEvaluationProducer(db, visibility_lag_seconds=0, max_span_ids_per_tick=window)
    await producer._tick()

    arrivals: list[int] = []
    newest_at_the_previous_tick = backlog[-1].id
    for _ in range(4):
        async with db() as session:
            arrivals += [(await _add_span(session, trace)).id for _ in range(2)]
        await producer._tick()
        assert (await _get_cursor(db)).produced_through_id == newest_at_the_previous_tick
        newest_at_the_previous_tick = arrivals[-1]
    await producer._tick()

    assert (await _get_cursor(db)).produced_through_id == arrivals[-1]
    async with db() as session:
        waiting = set(
            await session.scalars(
                select(models.EvalWorkUnit.span_rowid).where(
                    models.EvalWorkUnit.status == "PENDING"
                )
            )
        )
    assert waiting == {span.id for span in backlog} | set(arrivals)


def _stop_at_the_first_interval_sleep(
    daemon: Any, monkeypatch: pytest.MonkeyPatch, module: Any
) -> list[float]:
    """Record the delays a daemon's loop sleeps between ticks, stopping it at the first
    delay that is not zero."""
    sleeps: list[float] = []

    async def sleep(delay: float) -> None:
        sleeps.append(delay)
        if delay:
            daemon._running = False
        await asyncio.sleep(0)

    monkeypatch.setattr(
        module,
        "asyncio",
        SimpleNamespace(sleep=sleep, shield=asyncio.shield, ensure_future=asyncio.ensure_future),
    )
    return sleeps


async def test_cursor_regresses_to_live_span_high_water(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(db, produced_through_id=span.id + 100)

    producer = SpanEvaluationProducer(db)
    await producer._tick()

    assert (await _get_cursor(db)).produced_through_id == span.id


async def test_spans_that_reuse_deleted_span_ids_are_queued(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(5)]
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    await _seed_cursor(db, produced_through_id=spans[-1].id)
    async with db() as session:
        await session.merge(
            models.ProjectEvaluatorState(
                project_evaluator_id=project_evaluator_id, span_start_rowid=spans[-1].id
            )
        )
    producer = SpanEvaluationProducer(db, visibility_lag_seconds=0)

    async with db() as session:
        await session.execute(
            delete(models.Span).where(models.Span.id.in_([span.id for span in spans[2:]]))
        )
    await producer._tick()
    async with db() as session:
        new_spans = [await _add_span(session, trace) for _ in range(5)]
    for _ in range(3):
        await producer._tick()

    assert sorted(await _work_unit_span_rowids(db)) == sorted(span.id for span in new_spans)


async def test_scan_waits_until_the_visibility_lag_elapses(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(db)

    producer = SpanEvaluationProducer(db)
    await producer._tick()
    await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    assert (await _get_cursor(db)).produced_through_id == 0


async def test_catch_up_scan_catches_late_visible_span(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        late_span = await _add_span(session, trace)
        expired_span = await _add_span(session, trace)
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    span_cursor = expired_span.id
    producer = SpanEvaluationProducer(db)
    await _seed_cursor(db, produced_through_id=span_cursor)
    active = await producer._load_active_project_evaluators()
    assert len(active) == 1

    async with db() as session:
        session.add(
            models.EvalWorkUnit(
                span_rowid=expired_span.id,
                project_evaluator_id=project_evaluator_id,
                status="EXPIRED",
            )
        )

    await producer._catch_up_scan(active, span_cursor)

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    by_span = {unit.span_rowid: unit for unit in units}
    assert len(units) == 2
    assert by_span[late_span.id].status == "PENDING"
    assert by_span[expired_span.id].status == "EXPIRED"


async def test_editing_a_span_evaluator_does_not_requeue_evaluated_spans(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        evaluated_span = await _add_span(session, trace)
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    await _seed_cursor(db, produced_through_id=evaluated_span.id)
    async with db() as session:
        session.add(
            models.EvalWorkUnit(
                span_rowid=evaluated_span.id,
                project_evaluator_id=project_evaluator_id,
                status="DONE",
            )
        )
    async with db() as session:
        project_evaluator = await session.get(models.ProjectEvaluator, project_evaluator_id)
        assert project_evaluator is not None
        await apply_project_evaluator_patch(
            session,
            project_evaluator,
            ProjectEvaluatorPatch(name=Identifier(root=f"renamed-{token_hex(4)}")),
        )

    await SpanEvaluationProducer(db, catch_up_scan_interval_seconds=0)._tick()

    async with db() as session:
        statuses = {
            unit.span_rowid: unit.status
            for unit in await session.scalars(select(models.EvalWorkUnit))
        }
    assert statuses == {evaluated_span.id: "DONE"}


async def test_reaper_deletes_aged_terminal_work_outside_the_lookback(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(7)]
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    produced_through = spans[-1].id
    # With a lookback of 2, the last three spans sit inside the catch-up scan window.
    outside, inside = [span.id for span in spans[:4]], [span.id for span in spans[4:]]
    now = _now()
    ancient = now - timedelta(days=30)

    def _unit(span_rowid: int, **kwargs: object) -> models.EvalWorkUnit:
        return models.EvalWorkUnit(
            span_rowid=span_rowid,
            project_evaluator_id=project_evaluator_id,
            **kwargs,
        )

    async with db() as session:
        old_pending = _unit(outside[3], status="PENDING", created_at=ancient, updated_at=ancient)
        done_outside = _unit(outside[0], status="DONE", created_at=ancient, updated_at=ancient)
        done_inside = _unit(inside[0], status="DONE", created_at=ancient, updated_at=ancient)
        exhausted_error_outside = _unit(
            outside[1],
            status="FAILED",
            attempts=MAX_ATTEMPTS,
            created_at=ancient,
            updated_at=ancient,
        )
        retryable_error_outside = _unit(
            outside[2], status="ERROR", attempts=1, created_at=ancient, updated_at=ancient
        )
        session.add_all(
            [
                old_pending,
                done_outside,
                done_inside,
                exhausted_error_outside,
                retryable_error_outside,
            ]
        )
        await session.flush()
        ids = {
            "old_pending": old_pending.id,
            "done_outside": done_outside.id,
            "done_inside": done_inside.id,
            "exhausted_error_outside": exhausted_error_outside.id,
            "retryable_error_outside": retryable_error_outside.id,
        }

    await _seed_cursor(db, produced_through_id=produced_through)
    producer = SpanEvaluationProducer(db, catch_up_scan_lookback_span_ids=2)
    await producer._retention_cleanup(now)

    async with db() as session:
        remaining = {
            unit.id: (unit.status, unit.error)
            for unit in await session.scalars(select(models.EvalWorkUnit))
        }
    assert remaining.get(ids["old_pending"]) == ("PENDING", None)
    assert ids["done_outside"] not in remaining
    assert remaining.get(ids["done_inside"]) == ("DONE", None)
    assert ids["exhausted_error_outside"] not in remaining
    assert remaining.get(ids["retryable_error_outside"]) == ("ERROR", None)


async def test_unexpected_criteria_load_error_fails_closed(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An unexpected exception during project_evaluator resolution (e.g. a transient DB
    error) must abort the tick without advancing the cursor — advancing would
    silently skip the window for the project_evaluator that failed to load."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(db)
    producer = await _observed_producer(db)

    async def _transient_boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("transient version-lookup failure")

    monkeypatch.setattr(span_producer_module, "resolve_project_evaluators_bulk", _transient_boom)

    with pytest.raises(RuntimeError, match="transient version-lookup failure"):
        await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == 0


async def test_uncompilable_filter_is_skipped_without_stalling(db: DbSessionFactory) -> None:
    """A filter_condition that fails to compile is a persistent per-project_evaluator
    condition: the project_evaluator is skipped (operator-visibly, via log) while the
    cursor still advances for the healthy project_evaluator — one bad DSL string must
    not stall the shared cursor forever."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    _, good_criteria_id = await _seed_criteria(db, project.id)
    await _seed_criteria(db, project.id, filter_condition="span_kind ==")
    await _seed_cursor(db)

    producer = await _observed_producer(db)
    await producer._tick()

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    assert {unit.project_evaluator_id for unit in units} == {good_criteria_id}
    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == span.id


async def test_filter_that_fails_when_run_skips_only_its_own_evaluator(
    db: DbSessionFactory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        span = await _add_span(session, await _add_trace(session, project))
        other_project = await _add_project(session)
        other_span = await _add_span(session, await _add_trace(session, other_project))
    _, broken_project_evaluator_id = await _seed_criteria(
        db,
        project.id,
        # Compiles, but the literal is out of range for the column it is compared with.
        filter_condition="llm.token_count.total > 99999999999999999999",
    )
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    _, other_project_evaluator_id = await _seed_criteria(db, other_project.id)
    await _seed_cursor(db)
    producer = await _observed_producer(db)

    with caplog.at_level("WARNING", logger=span_producer_module.__name__):
        await producer._tick()
        await producer._catch_up_scan(
            await producer._load_active_project_evaluators(), other_span.id
        )

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    assert {(unit.project_evaluator_id, unit.span_rowid) for unit in units} == {
        (project_evaluator_id, span.id),
        (other_project_evaluator_id, other_span.id),
    }
    assert (await _get_cursor(db)).produced_through_id == other_span.id
    skipped = [
        record.getMessage()
        for record in caplog.records
        if f"project evaluator {broken_project_evaluator_id} " in record.getMessage()
    ]
    assert len(skipped) == 2  # once for the scan window, once for the catch-up scan
    assert all("filter condition failed when run" in message for message in skipped)


async def test_lease_stand_down_and_stale_reclaim(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(db)
    producer = await _observed_producer(db)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkLease).values(holder="rival-producer", heartbeat_at=_now())
        )

    await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    assert (await _get_cursor(db)).produced_through_id == 0

    async with db() as session:
        await session.execute(
            update(models.EvalWorkLease).values(
                heartbeat_at=_now() - timedelta(seconds=SCAN_LEASE_TTL_SECONDS + 1)
            )
        )
    await producer._tick()

    assert (await _get_cursor(db)).produced_through_id == span.id
    assert sorted(await _work_unit_span_rowids(db)) == [span.id]


@pytest.mark.parametrize("span_count", [1, 2], ids=["consumed", "cut"])
async def test_a_stale_scan_window_never_moves_the_span_cursor_backwards(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    span_count: int,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(span_count)]
    await _seed_criteria(db, project.id)
    await _seed_cursor(db, produced_through_id=spans[0].id - 1)
    rival_position = spans[-1].id + 5

    producer = await _observed_producer(db, max_span_ids_per_tick=1)
    load_active = producer._load_active_project_evaluators

    async def _load_then_rival_advances() -> list[span_producer_module._ActiveProjectEvaluator]:
        active = await load_active()
        async with db() as session:
            await session.execute(
                update(models.EvalSpanCursor).values(produced_through_id=rival_position)
            )
        return active

    monkeypatch.setattr(producer, "_load_active_project_evaluators", _load_then_rival_advances)
    await producer._tick()

    assert (await _get_cursor(db)).produced_through_id == rival_position


async def test_stale_clamp_leaves_a_cursor_another_producer_moved(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_cursor(db, produced_through_id=span.id + 10)
    rival_position = span.id - 1

    producer = SpanEvaluationProducer(db)
    clamp_cursor = producer._clamp_cursor

    async def _rival_moves_then_clamp(
        cursor: models.EvalSpanCursor,
    ) -> models.EvalSpanCursor | None:
        async with db() as session:
            await session.execute(
                update(models.EvalSpanCursor).values(produced_through_id=rival_position)
            )
        return await clamp_cursor(cursor)

    monkeypatch.setattr(producer, "_clamp_cursor", _rival_moves_then_clamp)
    await producer._tick()

    assert (await _get_cursor(db)).produced_through_id == rival_position


async def test_producer_publishes_its_own_cursor_lag_and_ingest_gauges(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Both gauges describe the arrival log the producer owns and are sampled at its
    own tick, so they keep reporting whether or not any consumer is running.
    """
    monkeypatch.setattr(span_producer_module, "get_env_enable_prometheus", lambda: True)
    cursor_lag = Mock()
    ingest_rate = Mock()
    monkeypatch.setattr(span_producer_module, "ONLINE_EVAL_SPAN_CURSOR_LAG_SPAN_IDS", cursor_lag)
    monkeypatch.setattr(span_producer_module, "ONLINE_EVAL_INGEST_SPANS_PER_SECOND", ingest_rate)

    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        await _add_span(session, trace)
    await _seed_criteria(db, project.id)

    producer = SpanEvaluationProducer(db, visibility_lag_seconds=0.0)

    # Cold start pins the cursor at the current high water, so nothing is behind.
    await producer._tick()
    cursor_lag.set.assert_called_once_with(0)
    ingest_rate.set.assert_not_called()

    # One arrival puts the log ahead of the cursor and takes the first sample.
    async with db() as session:
        await _add_span(session, await session.get(models.Trace, trace.id))
    await producer._tick()
    assert cursor_lag.set.call_args.args[0] == 1
    ingest_rate.set.assert_not_called()

    # The second sample is what a rate can be differenced from.
    async with db() as session:
        await _add_span(session, await session.get(models.Trace, trace.id))
    await producer._tick()
    ingest_rate.set.assert_called_once()
    assert ingest_rate.set.call_args.args[0] > 0


async def test_producer_counts_the_work_it_queues(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(span_producer_module, "get_env_enable_prometheus", lambda: True)
    added_counter = Mock()
    monkeypatch.setattr(span_producer_module, "ONLINE_EVAL_ADDED_WORK_UNITS", added_counter)
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(3)]
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    async with db() as session:
        session.add(
            models.EvalWorkUnit(span_rowid=spans[0].id, project_evaluator_id=project_evaluator_id)
        )
    await _seed_cursor(db, produced_through_id=spans[0].id - 1)

    await (await _observed_producer(db))._tick()

    # The span that already had work is not written again, so it is not counted.
    added_counter.labels.return_value.inc.assert_called_once_with(2)


async def test_cursor_lag_gauges_keep_updating_while_the_observation_ages(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(span_producer_module, "get_env_enable_prometheus", lambda: True)
    cursor_lag = Mock()
    monkeypatch.setattr(span_producer_module, "ONLINE_EVAL_SPAN_CURSOR_LAG_SPAN_IDS", cursor_lag)
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(db, produced_through_id=span.id - 1)
    producer = SpanEvaluationProducer(db, visibility_lag_seconds=3600)
    ingest_samples: list[int] = []
    publish_ingest_rate = producer._publish_ingest_rate

    def _sample_ingest_rate(high_water: int, observed_at: datetime) -> None:
        ingest_samples.append(high_water)
        publish_ingest_rate(high_water, observed_at)

    monkeypatch.setattr(producer, "_publish_ingest_rate", _sample_ingest_rate)

    async def _add_spans(count: int) -> None:
        async with db() as session:
            for _ in range(count):
                await _add_span(session, await session.get(models.Trace, trace.id))

    await producer._tick()
    assert cursor_lag.set.call_args.args[0] == 1
    await _add_spans(2)
    await producer._tick()
    assert cursor_lag.set.call_args.args[0] == 3
    assert ingest_samples[-1] == span.id + 2

    await _add_spans(3)
    await producer._tick()
    assert cursor_lag.set.call_args.args[0] == 6
    assert ingest_samples[-1] == span.id + 5
    assert (await _get_cursor(db)).produced_through_id == span.id - 1
