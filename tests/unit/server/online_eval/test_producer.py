from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any
from unittest.mock import Mock

import pytest
from sqlalchemy import func, select, update

from phoenix.db import models
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
from phoenix.server.api.evaluators import ContainsEvaluator
from phoenix.server.encryption import EncryptionService
from phoenix.server.online_eval import producer as producer_module
from phoenix.server.online_eval.db_coordinator import DbEvalWorkCoordinator
from phoenix.server.online_eval.derivation import (
    MAX_ATTEMPTS,
    config_fingerprint,
)
from phoenix.server.online_eval.leases import MATERIALIZER_LEASE_TTL_SECONDS
from phoenix.server.online_eval.producer import OnlineEvalProducer
from phoenix.server.online_eval.project_evaluator_resolution import (
    resolve_project_evaluator,
    resolve_project_evaluators_bulk,
)
from phoenix.server.types import DbSessionFactory

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
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
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
            evaluation_target="SPAN",
        )
        session.add(project_evaluator)
        await session.flush()
        return evaluator.id, project_evaluator.id, sandbox_config.id


async def _seed_cursor(
    db: DbSessionFactory,
    *,
    produced_through_id: int = 0,
    observed_high_water_id: int | None = None,
    observed_at: datetime | None = None,
) -> None:
    async with db() as session:
        session.add(
            models.EvalSpanCursor(
                id=1,
                produced_through_id=produced_through_id,
                observed_high_water_id=observed_high_water_id,
                observed_at=observed_at,
            )
        )


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

    producer = OnlineEvalProducer(db)
    await producer._tick()

    async with db() as session:
        cursor = (await session.scalars(select(models.EvalSpanCursor))).one()
        lease = (await session.scalars(select(models.EvalWorkLease))).one()
    assert cursor.produced_through_id == spans[-1].id
    assert lease.holder == producer._lease.holder
    assert await _work_unit_span_rowids(db) == []


async def test_storage_pause_skips_materialization_and_cursor_advance(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(
        db,
        produced_through_id=0,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )
    producer = OnlineEvalProducer(db)
    db.should_not_insert_or_update = True

    try:
        await producer._tick()
    finally:
        db.should_not_insert_or_update = False

    assert await _work_unit_span_rowids(db) == []
    assert (await _get_cursor(db)).produced_through_id == 0


async def test_tick_materializes_matching_spans_and_advances_watermark(
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
    await _seed_cursor(
        db,
        observed_high_water_id=high_water,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    materialized = await _work_unit_span_rowids(db)
    assert sorted(materialized) == sorted(span.id for span in llm_spans)
    assert tool_span.id not in materialized
    assert other_span.id not in materialized

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    for unit in units:
        assert unit.status == "PENDING"
        assert unit.project_evaluator_id == project_evaluator_id

    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == high_water

    # Re-scanning the same window is idempotent under the work-key unique constraint.
    async with db() as session:
        await session.execute(
            update(models.EvalSpanCursor).values(
                produced_through_id=0,
                observed_high_water_id=high_water,
                observed_at=_now() - timedelta(seconds=120),
            )
        )
    await producer._tick()
    assert len(await _work_unit_span_rowids(db)) == len(llm_spans)


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

        first = await resolve_project_evaluator(session, project_evaluator, evaluator)
        assert first is not None
        monkeypatch.setattr(ContainsEvaluator, "implementation_version", "2")
        second = await resolve_project_evaluator(session, project_evaluator, evaluator)
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

        before = await resolve_project_evaluator(session, project_evaluator, evaluator)
        assert before is not None

        # Repoint the provider at a different endpoint. The prompt version — and so the
        # pre-fix version_ref — is untouched.
        provider.config = EncryptionService().encrypt(b'{"base_url": "https://self.hosted"}')
        provider.updated_at = _now() + timedelta(minutes=1)
        await session.flush()

        after = await resolve_project_evaluator(session, project_evaluator, evaluator)
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

        assert await resolve_project_evaluator(session, project_evaluator, evaluator) is None


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
        first = await resolve_project_evaluator(session, project_evaluator, evaluator)
        assert first is not None
        sandbox_config.timeout += 1
        sandbox_config.updated_at = _now() + timedelta(seconds=1)
        await session.flush()
        second = await resolve_project_evaluator(session, project_evaluator, evaluator)
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

        assert await resolve_project_evaluator(session, project_evaluator, evaluator) is None


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

    async def _counting_resolver(*args: Any, **kwargs: Any) -> Any:
        call_sizes.append(len(args[1]))
        return await resolve_project_evaluators_bulk(*args, **kwargs)

    monkeypatch.setattr(producer_module, "resolve_project_evaluators_bulk", _counting_resolver)

    active = await OnlineEvalProducer(db)._load_active_project_evaluators()

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

    producer = OnlineEvalProducer(db)

    assert await producer._load_active_project_evaluators() == []


async def test_tick_advances_at_most_one_id_chunk(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_SPAN_IDS_PER_TICK", "2")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(5)]
    await _seed_criteria(db, project.id)
    low_exclusive = spans[0].id - 1
    observed_at = _now() - timedelta(seconds=120)
    await _seed_cursor(
        db,
        produced_through_id=low_exclusive,
        observed_high_water_id=spans[-1].id,
        observed_at=observed_at,
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == low_exclusive + 2
    assert cursor.observed_high_water_id == spans[-1].id
    assert cursor.observed_at == observed_at
    assert sorted(await _work_unit_span_rowids(db)) == [span.id for span in spans[:2]]

    await producer._tick()

    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == low_exclusive + 4
    assert sorted(await _work_unit_span_rowids(db)) == [span.id for span in spans[:4]]


async def test_materialization_budget_truncates_without_advancing(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_OUTSTANDING", "3")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(2)]
    await _seed_criteria(db, project.id)
    await _seed_criteria(db, project.id)
    low_exclusive = spans[0].id - 1
    await _seed_cursor(
        db,
        produced_through_id=low_exclusive,
        observed_high_water_id=spans[-1].id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    async with db() as session:
        unit_count = await session.scalar(select(func.count()).select_from(models.EvalWorkUnit))
    assert unit_count == 3
    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == low_exclusive
    assert await producer._admission_budget() == 0

    coordinator = DbEvalWorkCoordinator(db)
    admitted = await coordinator.claim(claimed_by="consumer", limit=3)
    assert len(admitted) == 3
    for unit in admitted:
        assert await coordinator.complete(
            work_unit_id=unit.work_unit_id,
            claimed_by="consumer",
        )

    await producer._tick()

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    assert len(units) == 4
    assert sum(unit.status == "DONE" for unit in units) == 3
    assert sum(unit.status == "PENDING" for unit in units) == 1
    assert (await _get_cursor(db)).produced_through_id == spans[-1].id


@pytest.mark.parametrize("value", ["0", "-1"])
async def test_max_span_ids_per_tick_must_be_positive(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_SPAN_IDS_PER_TICK", value)

    with pytest.raises(ValueError, match="Value must be a positive integer"):
        OnlineEvalProducer(db)


async def test_cursor_regresses_to_live_span_high_water(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    stale_high_water = span.id + 100
    await _seed_cursor(
        db,
        produced_through_id=stale_high_water,
        observed_high_water_id=stale_high_water,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == span.id
    assert cursor.observed_high_water_id is None
    assert cursor.observed_at is None


async def test_frontier_gate_holds_until_lag_elapses(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    observed_at = _now()
    await _seed_cursor(db, observed_high_water_id=span.id, observed_at=observed_at)

    producer = OnlineEvalProducer(db)
    await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == 0
    # The pending observation is held so it can age past the lag gate — a tick
    # must not reset observed_at while the observation is unconsumed.
    assert cursor.observed_high_water_id == span.id
    assert cursor.observed_at == observed_at


async def test_backstop_catches_late_visible_span(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        late_span = await _add_span(session, trace)
        expired_span = await _add_span(session, trace)
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    watermark = expired_span.id
    producer = OnlineEvalProducer(db)
    await _seed_cursor(db, produced_through_id=watermark)
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

    await producer._backstop_sweep(active, watermark, 10)

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    by_span = {unit.span_rowid: unit for unit in units}
    assert len(units) == 2
    assert by_span[late_span.id].status == "PENDING"
    assert by_span[expired_span.id].status == "EXPIRED"


async def test_backstop_stops_at_insertion_budget(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(3)]
    await _seed_criteria(db, project.id)

    producer = OnlineEvalProducer(db)
    await _seed_cursor(db, produced_through_id=spans[-1].id)
    active = await producer._load_active_project_evaluators()
    remaining = await producer._backstop_sweep(active, spans[-1].id, 2)

    assert remaining == 0
    assert len(await _work_unit_span_rowids(db)) == 2


async def test_editing_a_span_evaluator_does_not_requeue_evaluated_spans(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        evaluated_span = await _add_span(session, trace, span_kind="LLM")
        late_span = await _add_span(session, trace, span_kind="LLM")
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    producer = OnlineEvalProducer(db)
    await _seed_cursor(db, produced_through_id=late_span.id)
    async with db() as session:
        session.add(
            models.EvalWorkUnit(
                span_rowid=evaluated_span.id,
                project_evaluator_id=project_evaluator_id,
                status="DONE",
            )
        )
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(filter_condition="span_kind == 'LLM'")
        )

    active = await producer._load_active_project_evaluators()
    await producer._backstop_sweep(active, late_span.id, 10)

    async with db() as session:
        statuses = {
            unit.span_rowid: unit.status
            for unit in await session.scalars(select(models.EvalWorkUnit))
        }
    assert statuses == {evaluated_span.id: "DONE", late_span.id: "PENDING"}


async def test_reaper_deletes_aged_terminal_work_outside_the_lookback(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_BACKSTOP_LOOKBACK_SPAN_IDS", "2")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(7)]
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    produced_through = spans[-1].id
    # With a lookback of 2, the last three spans sit inside the backstop window.
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

    producer = OnlineEvalProducer(db)
    await producer._reap(now, produced_through)

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


async def test_admission_gate_skips_materialization(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_OUTSTANDING", "1")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
        backlog_spans = [await _add_span(session, trace) for _ in range(2)]
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    async with db() as session:
        session.add_all(
            [
                models.EvalWorkUnit(
                    span_rowid=backlog_span.id,
                    project_evaluator_id=project_evaluator_id,
                )
                for backlog_span in backlog_spans
            ]
        )
    await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    async with db() as session:
        unit_count = await session.scalar(select(func.count()).select_from(models.EvalWorkUnit))
    assert unit_count == 2
    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == 0


async def test_admission_budget_counts_nonterminal_backlog(db: DbSessionFactory) -> None:
    """The gate bounds all backlog that will eventually demand consumer
    capacity: RUNNING and retryable-ERROR rows count alongside PENDING (under
    a provider outage the pending population migrates into retryable ERROR),
    while exhausted ERROR is terminal and must not hold the gate closed."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = iter([await _add_span(session, trace) for _ in range(3)])
    _, project_evaluator_id = await _seed_criteria(db, project.id)

    def _unit(status: str, **kwargs: Any) -> models.EvalWorkUnit:
        return models.EvalWorkUnit(
            span_rowid=next(spans).id,
            project_evaluator_id=project_evaluator_id,
            status=status,
            **kwargs,
        )

    producer = OnlineEvalProducer(db)
    producer._max_outstanding = 1
    assert await producer._admission_budget() == 1

    async with db() as session:
        session.add(_unit("FAILED", attempts=MAX_ATTEMPTS))
    assert await producer._admission_budget() == 1

    async with db() as session:
        session.add(_unit("RUNNING", claimed_by="consumer-1", claimed_at=_now()))
        await session.flush()
        running_id = (
            await session.scalars(
                select(models.EvalWorkUnit.id).order_by(models.EvalWorkUnit.id.desc()).limit(1)
            )
        ).one()
    assert await producer._admission_budget() == 0

    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == running_id)
            .values(status="DONE")
        )
    assert await producer._admission_budget() == 1

    async with db() as session:
        session.add(_unit("ERROR", attempts=1))
    assert await producer._admission_budget() == 0


@pytest.mark.parametrize(
    ("outstanding_count", "expected_budget"),
    [(2, 1), (3, 0), (4, 0)],
)
async def test_admission_budget_count_is_bounded_at_ceiling(
    db: DbSessionFactory,
    outstanding_count: int,
    expected_budget: int,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(outstanding_count)]
    _, project_evaluator_id = await _seed_criteria(db, project.id)
    async with db() as session:
        session.add_all(
            [
                models.EvalWorkUnit(
                    span_rowid=span.id,
                    project_evaluator_id=project_evaluator_id,
                )
                for span in spans
            ]
        )

    producer = OnlineEvalProducer(db)
    producer._max_outstanding = 3

    assert await producer._admission_budget() == expected_budget


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
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    async def _transient_boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("transient version-lookup failure")

    monkeypatch.setattr(producer_module, "resolve_project_evaluators_bulk", _transient_boom)

    producer = OnlineEvalProducer(db)
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
    await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    assert {unit.project_evaluator_id for unit in units} == {good_criteria_id}
    cursor = await _get_cursor(db)
    assert cursor.produced_through_id == span.id


async def test_lease_stand_down_and_stale_reclaim(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )
    async with db() as session:
        session.add(
            models.EvalWorkLease(name="span-producer", holder="rival-producer", heartbeat_at=_now())
        )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    assert (await _get_cursor(db)).produced_through_id == 0

    async with db() as session:
        await session.execute(
            update(models.EvalWorkLease).values(
                heartbeat_at=_now() - timedelta(seconds=MATERIALIZER_LEASE_TTL_SECONDS + 1)
            )
        )
    await producer._tick()

    assert (await _get_cursor(db)).produced_through_id == span.id
    assert sorted(await _work_unit_span_rowids(db)) == [span.id]


async def test_producer_publishes_its_own_frontier_and_ingest_gauges(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Both gauges describe the arrival log the producer owns and are sampled at its
    own tick, so they keep reporting whether or not any consumer is running.
    """
    monkeypatch.setattr(producer_module, "get_env_enable_prometheus", lambda: True)
    frontier_gap = Mock()
    ingest_rate = Mock()
    monkeypatch.setattr(producer_module, "ONLINE_EVAL_FRONTIER_GAP_SPAN_IDS", frontier_gap)
    monkeypatch.setattr(producer_module, "ONLINE_EVAL_INGEST_SPANS_PER_SECOND", ingest_rate)

    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        await _add_span(session, trace)
    await _seed_criteria(db, project.id)

    producer = OnlineEvalProducer(db)
    producer._frontier_lag_seconds = 0.0

    # Cold start pins the watermark at the current high water, so nothing is behind.
    await producer._tick()
    frontier_gap.set.assert_called_once_with(0)
    ingest_rate.set.assert_not_called()

    # One arrival puts the log ahead of the watermark and takes the first sample.
    async with db() as session:
        await _add_span(session, await session.get(models.Trace, trace.id))
    await producer._tick()
    assert frontier_gap.set.call_args.args[0] == 1
    ingest_rate.set.assert_not_called()

    # The second sample is what a rate can be differenced from.
    async with db() as session:
        await _add_span(session, await session.get(models.Trace, trace.id))
    await producer._tick()
    ingest_rate.set.assert_called_once()
    assert ingest_rate.set.call_args.args[0] > 0
