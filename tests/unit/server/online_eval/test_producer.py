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
from phoenix.server.online_eval.consumer import OnlineEvalConsumer
from phoenix.server.online_eval.coordinator import (
    LEASE_ATTEMPTS_EXHAUSTED_ERROR,
    LEASE_TTL_SECONDS,
)
from phoenix.server.online_eval.criteria_resolution import (
    resolve_criteria,
    resolve_criteria_bulk,
)
from phoenix.server.online_eval.db_coordinator import DbEvalWorkCoordinator
from phoenix.server.online_eval.derivation import (
    MAX_ATTEMPTS,
    STALE_FINGERPRINT_ERROR,
    annotation_identifier,
    config_fingerprint,
)
from phoenix.server.online_eval.producer import OnlineEvalProducer
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
    """Create a builtin evaluator and a criteria row, returning
    (evaluator_id, criteria_id)."""
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
            filter_condition=filter_condition,
            sampling_rate=sampling_rate,
            evaluation_target=evaluation_target,
        )
        session.add(criteria)
        await session.flush()
        return evaluator.id, criteria.id


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
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project_id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(criteria)
        await session.flush()
        return evaluator.id, criteria.id, sandbox_config.id


async def _seed_cursor(
    db: DbSessionFactory,
    *,
    produced_through_id: int = 0,
    observed_high_water_id: int | None = None,
    observed_at: datetime | None = None,
    claimed_by: str | None = None,
    claimed_at: datetime | None = None,
) -> int:
    async with db() as session:
        cursor = models.EvalWorkCursor(
            evaluation_target="SPAN",
            consumer_group="default",
            produced_through_id=produced_through_id,
            observed_high_water_id=observed_high_water_id,
            observed_at=observed_at,
            claimed_by=claimed_by,
            claimed_at=claimed_at,
        )
        session.add(cursor)
        await session.flush()
        return cursor.id


async def _get_cursor(db: DbSessionFactory, cursor_id: int) -> models.EvalWorkCursor:
    async with db() as session:
        cursor = await session.get(models.EvalWorkCursor, cursor_id)
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
        cursor = (
            await session.scalars(
                select(models.EvalWorkCursor).where(
                    models.EvalWorkCursor.evaluation_target == "SPAN",
                    models.EvalWorkCursor.consumer_group == "default",
                )
            )
        ).one()
    assert cursor.produced_through_id == spans[-1].id
    assert cursor.claimed_by == producer._producer_id
    assert await _work_unit_span_rowids(db) == []


async def test_storage_pause_skips_materialization_and_cursor_advance(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    cursor_id = await _seed_cursor(
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
    assert (await _get_cursor(db, cursor_id)).produced_through_id == 0


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
    evaluator_id, criteria_id = await _seed_criteria(
        db, project.id, filter_condition="span_kind == 'LLM'"
    )
    high_water = other_span.id
    cursor_id = await _seed_cursor(
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
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        evaluator = await session.get(models.BuiltinEvaluator, evaluator_id)
        assert evaluator is not None
        resolved = await resolve_criteria(session, criteria, evaluator)
        assert resolved is not None
        expected_fingerprint = config_fingerprint(resolved)
    for unit in units:
        assert unit.status == "PENDING"
        assert unit.evaluator_id == evaluator_id
        assert unit.criteria_id == criteria_id
        assert unit.config_fingerprint == expected_fingerprint

    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == high_water
    assert cursor.claimed_by == producer._producer_id

    # Re-scanning the same window is idempotent under the work-key unique constraint.
    async with db() as session:
        await session.execute(
            update(models.EvalWorkCursor)
            .where(models.EvalWorkCursor.id == cursor_id)
            .values(
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
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root="criteria"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(criteria)
        await session.flush()

        first = await resolve_criteria(session, criteria, evaluator)
        assert first is not None
        monkeypatch.setattr(ContainsEvaluator, "implementation_version", "2")
        second = await resolve_criteria(session, criteria, evaluator)
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
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(criteria)
        await session.flush()

        before = await resolve_criteria(session, criteria, evaluator)
        assert before is not None

        # Repoint the provider at a different endpoint. The prompt version — and so the
        # pre-fix version_ref — is untouched.
        provider.config = EncryptionService().encrypt(b'{"base_url": "https://self.hosted"}')
        provider.updated_at = _now() + timedelta(minutes=1)
        await session.flush()

        after = await resolve_criteria(session, criteria, evaluator)
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
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root="criteria"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(criteria)
        await session.flush()

        assert await resolve_criteria(session, criteria, evaluator) is None


async def test_sandbox_runtime_changes_code_criteria_fingerprint(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
    evaluator_id, criteria_id, sandbox_config_id = await _seed_code_criteria(db, project.id)

    async with db() as session:
        evaluator = await session.get(models.CodeEvaluator, evaluator_id)
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        sandbox_config = await session.get(models.SandboxConfig, sandbox_config_id)
        assert evaluator is not None
        assert criteria is not None
        assert sandbox_config is not None
        first = await resolve_criteria(session, criteria, evaluator)
        assert first is not None
        sandbox_config.timeout += 1
        sandbox_config.updated_at = _now() + timedelta(seconds=1)
        await session.flush()
        second = await resolve_criteria(session, criteria, evaluator)
        assert second is not None

    assert config_fingerprint(first) != config_fingerprint(second)


async def test_disabled_sandbox_runtime_does_not_resolve_code_criteria(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
    evaluator_id, criteria_id, sandbox_config_id = await _seed_code_criteria(db, project.id)

    async with db() as session:
        evaluator = await session.get(models.CodeEvaluator, evaluator_id)
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        sandbox_config = await session.get(models.SandboxConfig, sandbox_config_id)
        assert evaluator is not None
        assert criteria is not None
        assert sandbox_config is not None
        sandbox_config.enabled = False
        await session.flush()

        assert await resolve_criteria(session, criteria, evaluator) is None


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
        return await resolve_criteria_bulk(*args, **kwargs)

    monkeypatch.setattr(producer_module, "resolve_criteria_bulk", _counting_resolver)

    active = await OnlineEvalProducer(db)._load_active_criteria()

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

    assert await producer._load_active_criteria() == []


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
    cursor_id = await _seed_cursor(
        db,
        produced_through_id=low_exclusive,
        observed_high_water_id=spans[-1].id,
        observed_at=observed_at,
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == low_exclusive + 2
    assert cursor.observed_high_water_id == spans[-1].id
    assert cursor.observed_at == observed_at
    assert sorted(await _work_unit_span_rowids(db)) == [span.id for span in spans[:2]]

    await producer._tick()

    cursor = await _get_cursor(db, cursor_id)
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
    cursor_id = await _seed_cursor(
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
    cursor = await _get_cursor(db, cursor_id)
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
    assert (await _get_cursor(db, cursor_id)).produced_through_id == spans[-1].id


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
    cursor_id = await _seed_cursor(
        db,
        produced_through_id=stale_high_water,
        observed_high_water_id=stale_high_water,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    cursor = await _get_cursor(db, cursor_id)
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
    cursor_id = await _seed_cursor(db, observed_high_water_id=span.id, observed_at=observed_at)

    producer = OnlineEvalProducer(db)
    await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    cursor = await _get_cursor(db, cursor_id)
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
        annotated_span = await _add_span(session, trace)
        expired_span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    watermark = expired_span.id
    producer = OnlineEvalProducer(db)
    await _seed_cursor(
        db,
        produced_through_id=watermark,
        claimed_by=producer._producer_id,
        claimed_at=_now(),
    )
    active = await producer._load_active_criteria()
    assert len(active) == 1
    criteria = active[0]

    async with db() as session:
        session.add(
            models.SpanAnnotation(
                span_rowid=annotated_span.id,
                name=criteria.name,
                label="ok",
                score=1.0,
                explanation=None,
                metadata_={},
                annotator_kind="LLM",
                identifier=criteria.identifier,
                source="API",
                user_id=None,
            )
        )
        session.add(
            models.EvalWorkUnit(
                span_rowid=expired_span.id,
                evaluator_id=evaluator_id,
                criteria_id=criteria_id,
                config_fingerprint=criteria.fingerprint,
                status="EXPIRED",
            )
        )

    await producer._backstop_sweep(active, watermark, 10)

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    by_span = {unit.span_rowid: unit for unit in units}
    assert len(units) == 2
    assert by_span[late_span.id].status == "PENDING"
    assert annotated_span.id not in by_span
    assert by_span[expired_span.id].status == "EXPIRED"


async def test_backstop_stops_at_insertion_budget(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(3)]
    await _seed_criteria(db, project.id)

    producer = OnlineEvalProducer(db)
    await _seed_cursor(
        db,
        produced_through_id=spans[-1].id,
        claimed_by=producer._producer_id,
        claimed_at=_now(),
    )
    active = await producer._load_active_criteria()
    remaining = await producer._backstop_sweep(active, spans[-1].id, 2)

    assert remaining == 0
    assert len(await _work_unit_span_rowids(db)) == 2


async def test_stale_fingerprint_rows_are_resurrected_when_config_reverts(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(3)]
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    await _seed_cursor(
        db,
        produced_through_id=spans[0].id - 1,
        observed_high_water_id=spans[-1].id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    async with db() as session:
        evaluator = await session.get(models.BuiltinEvaluator, evaluator_id)
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert evaluator is not None
        assert criteria is not None
        original_key = evaluator.key
        original_synced_at = evaluator.synced_at
        resolved = await resolve_criteria(session, criteria, evaluator)
        assert resolved is not None
        original_fingerprint = config_fingerprint(resolved)
        evaluator.key = f"{original_key}-changed"
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.span_rowid == spans[0].id)
            .values(attempts=2)
        )

    coordinator = DbEvalWorkCoordinator(db)
    claimed = await coordinator.claim(claimed_by="consumer", limit=3)
    assert len(claimed) == 3
    for unit in claimed:
        assert await coordinator.expire(
            work_unit_id=unit.work_unit_id,
            claimed_by="consumer",
            error=STALE_FINGERPRINT_ERROR,
        )

    async with db() as session:
        evaluator = await session.get(models.BuiltinEvaluator, evaluator_id)
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert evaluator is not None
        assert criteria is not None
        evaluator.key = original_key
        evaluator.synced_at = original_synced_at
        session.add_all(
            [
                models.SpanAnnotation(
                    span_rowid=spans[0].id,
                    name=criteria.name.root,
                    label="old",
                    score=0.0,
                    explanation=None,
                    metadata_={},
                    annotator_kind="LLM",
                    identifier=annotation_identifier("different-fingerprint"),
                    source="API",
                    user_id=None,
                ),
                models.SpanAnnotation(
                    span_rowid=spans[1].id,
                    name=criteria.name.root,
                    label="done",
                    score=1.0,
                    explanation=None,
                    metadata_={},
                    annotator_kind="LLM",
                    identifier=annotation_identifier(original_fingerprint),
                    source="API",
                    user_id=None,
                ),
            ]
        )
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.span_rowid == spans[2].id)
            .values(status="DONE")
        )

    producer._backstop_interval_seconds = 0
    await producer._tick()

    async with db() as session:
        units = list(
            await session.scalars(
                select(models.EvalWorkUnit).order_by(models.EvalWorkUnit.span_rowid)
            )
        )
    assert [unit.config_fingerprint for unit in units] == [original_fingerprint] * 3
    assert units[0].status == "PENDING"
    assert units[0].attempts == 0
    assert units[0].error is None
    assert units[0].claimed_by is None
    assert units[0].claimed_at is None
    assert units[0].cooldown_until is None
    assert units[1].status == "EXPIRED"
    assert units[1].error == STALE_FINGERPRINT_ERROR
    assert units[2].status == "DONE"


async def test_transcript_caps_enter_the_session_fingerprint(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Transcript caps decide what text a session evaluator reads, so a cap change
    has to change the identity — results under one identifier must be comparable."""
    async with db() as session:
        project = await _add_project(session)
    evaluator_id, criteria_id = await _seed_criteria(
        db,
        project.id,
        evaluation_target="SESSION",
    )

    async def _fingerprint() -> str:
        async with db() as session:
            criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
            evaluator = await session.get(models.BuiltinEvaluator, evaluator_id)
            assert criteria is not None
            assert evaluator is not None
            resolved = await resolve_criteria(session, criteria, evaluator)
            assert resolved is not None
            return config_fingerprint(resolved)

    baseline = await _fingerprint()
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES", "65536")
    widened_transcript = await _fingerprint()
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_LLM_MESSAGE_BYTES", "131072")
    widened_message = await _fingerprint()

    assert len({baseline, widened_transcript, widened_message}) == 3


async def test_consumer_stale_fingerprint_expiry_is_revived_when_config_reverts(
    db: DbSessionFactory,
) -> None:
    """The consumer's fingerprint-mismatch expiry and the producer's revival scan
    key on one constant; drifting apart makes a reverted criteria terminal."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    _, criteria_id = await _seed_criteria(db, project.id)
    await _seed_cursor(
        db,
        produced_through_id=span.id - 1,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )
    producer = OnlineEvalProducer(db)
    await producer._tick()

    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        original_sampling_rate = criteria.sampling_rate
        criteria.sampling_rate = 0.5

    await OnlineEvalConsumer(db, decrypt=lambda value: value)._cycle()

    async with db() as session:
        unit = await session.scalar(select(models.EvalWorkUnit))
        assert unit is not None
        assert unit.status == "EXPIRED"
        assert unit.error == STALE_FINGERPRINT_ERROR
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        criteria.sampling_rate = original_sampling_rate

    producer._backstop_interval_seconds = 0
    await producer._tick()

    async with db() as session:
        unit = await session.scalar(select(models.EvalWorkUnit))
    assert unit is not None
    assert unit.status == "PENDING"
    assert unit.attempts == 0
    assert unit.error is None


async def test_ttl_expired_row_is_not_resurrected(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_PENDING_TTL_SECONDS", "1")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    await _seed_cursor(
        db,
        produced_through_id=span.id - 1,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit).values(created_at=_now() - timedelta(seconds=10))
        )

    await producer._reap(_now(), span.id)
    active = await producer._load_active_criteria()
    await producer._backstop_sweep(active, span.id, 10)

    async with db() as session:
        unit = (await session.scalars(select(models.EvalWorkUnit))).one()
    assert unit.status == "EXPIRED"
    assert unit.error == "pending ttl exceeded"


async def test_reaper_transitions_and_deletes(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_BACKSTOP_LOOKBACK_SPAN_IDS", "2")
    # TTL shedding is opt-in (default off); this test exercises the opted-in path.
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_PENDING_TTL_SECONDS", "3600")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(5)]
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    produced_through = spans[-1].id
    outside, inside = spans[0].id, spans[-1].id
    now = _now()
    ancient = now - timedelta(days=30)

    def _unit(span_rowid: int, **kwargs: object) -> models.EvalWorkUnit:
        return models.EvalWorkUnit(
            span_rowid=span_rowid,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=f"fp-{token_hex(8)}",
            **kwargs,
        )

    async with db() as session:
        stale_pending = _unit(inside, status="PENDING", created_at=ancient)
        fresh_pending = _unit(inside, status="PENDING")
        done_outside = _unit(outside, status="DONE", created_at=ancient, updated_at=ancient)
        done_inside = _unit(inside, status="DONE", created_at=ancient, updated_at=ancient)
        exhausted_error_outside = _unit(
            outside,
            status="ERROR",
            attempts=MAX_ATTEMPTS,
            created_at=ancient,
            updated_at=ancient,
        )
        retryable_error_outside = _unit(
            outside, status="ERROR", attempts=1, created_at=ancient, updated_at=ancient
        )
        session.add_all(
            [
                stale_pending,
                fresh_pending,
                done_outside,
                done_inside,
                exhausted_error_outside,
                retryable_error_outside,
            ]
        )
        await session.flush()
        ids = {
            "stale_pending": stale_pending.id,
            "fresh_pending": fresh_pending.id,
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
    assert remaining.get(ids["stale_pending"]) == ("EXPIRED", "pending ttl exceeded")
    assert remaining.get(ids["fresh_pending"]) == ("PENDING", None)
    assert ids["done_outside"] not in remaining
    assert remaining.get(ids["done_inside"]) == ("DONE", None)
    assert ids["exhausted_error_outside"] not in remaining
    assert remaining.get(ids["retryable_error_outside"]) == ("ERROR", None)


async def test_reaper_default_keeps_old_pending_work(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With the pending TTL unset (the default), backlog never expires: a
    PENDING unit older than any drain window stays claimable instead of being
    shed. TTL expiry is terminal and blocks backstop re-materialization of the
    same fingerprint, so shedding must be an explicit operator opt-in."""
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_BACKSTOP_LOOKBACK_SPAN_IDS", "2")
    monkeypatch.delenv("PHOENIX_ONLINE_EVAL_PENDING_TTL_SECONDS", raising=False)
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    now = _now()
    ancient = now - timedelta(days=30)
    async with db() as session:
        old_pending = models.EvalWorkUnit(
            span_rowid=span.id,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=f"fp-{token_hex(8)}",
            status="PENDING",
            created_at=ancient,
        )
        session.add(old_pending)
        await session.flush()
        unit_id = old_pending.id

    producer = OnlineEvalProducer(db)
    await producer._reap(now, span.id)

    async with db() as session:
        unit = await session.get(models.EvalWorkUnit, unit_id)
    assert unit is not None
    assert unit.status == "PENDING"


async def test_reaper_terminalizes_only_lapsed_exhausted_running_work(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    now = _now()
    lapsed = now - timedelta(seconds=LEASE_TTL_SECONDS + 1)

    async with db() as session:
        lapsed_unit = models.EvalWorkUnit(
            span_rowid=span.id,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=f"fp-{token_hex(8)}",
            status="RUNNING",
            attempts=MAX_ATTEMPTS - 1,
            claimed_at=lapsed,
            claimed_by="consumer-1",
        )
        failed_lapsed_unit = models.EvalWorkUnit(
            span_rowid=span.id,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=f"fp-{token_hex(8)}",
            status="RUNNING",
            attempts=MAX_ATTEMPTS - 1,
            error="provider failed",
            claimed_at=lapsed,
            claimed_by="consumer-1",
        )
        fresh_unit = models.EvalWorkUnit(
            span_rowid=span.id,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=f"fp-{token_hex(8)}",
            status="RUNNING",
            attempts=MAX_ATTEMPTS - 1,
            claimed_at=now,
            claimed_by="consumer-1",
        )
        session.add_all([lapsed_unit, failed_lapsed_unit, fresh_unit])
        await session.flush()
        lapsed_id, failed_lapsed_id, fresh_id = (
            lapsed_unit.id,
            failed_lapsed_unit.id,
            fresh_unit.id,
        )

    producer = OnlineEvalProducer(db)
    await producer._reap(now, span.id)

    async with db() as session:
        lapsed_row = await session.get(models.EvalWorkUnit, lapsed_id)
        failed_lapsed_row = await session.get(models.EvalWorkUnit, failed_lapsed_id)
        fresh_row = await session.get(models.EvalWorkUnit, fresh_id)
    assert lapsed_row is not None
    assert lapsed_row.status == "ERROR"
    assert lapsed_row.attempts == MAX_ATTEMPTS
    assert lapsed_row.error == LEASE_ATTEMPTS_EXHAUSTED_ERROR
    assert failed_lapsed_row is not None
    assert failed_lapsed_row.status == "ERROR"
    assert failed_lapsed_row.attempts == MAX_ATTEMPTS
    assert failed_lapsed_row.error == "provider failed"
    assert fresh_row is not None
    assert fresh_row.status == "RUNNING"
    competitor = DbEvalWorkCoordinator(db)
    assert await competitor.claim(claimed_by="consumer-2", limit=2) == []


async def test_admission_gate_skips_materialization(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_OUTSTANDING", "1")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
        backlog_span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    async with db() as session:
        session.add_all(
            [
                models.EvalWorkUnit(
                    span_rowid=backlog_span.id,
                    evaluator_id=evaluator_id,
                    criteria_id=criteria_id,
                    config_fingerprint=f"fp-{token_hex(8)}",
                )
                for _ in range(2)
            ]
        )
    cursor_id = await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    async with db() as session:
        unit_count = await session.scalar(select(func.count()).select_from(models.EvalWorkUnit))
    assert unit_count == 2
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == 0


async def test_admission_budget_counts_nonterminal_backlog(db: DbSessionFactory) -> None:
    """The gate bounds all backlog that will eventually demand consumer
    capacity: RUNNING and retryable-ERROR rows count alongside PENDING (under
    a provider outage the pending population migrates into retryable ERROR),
    while exhausted ERROR is terminal and must not hold the gate closed."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)

    def _unit(status: str, **kwargs: Any) -> models.EvalWorkUnit:
        return models.EvalWorkUnit(
            span_rowid=span.id,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=f"fp-{token_hex(8)}",
            status=status,
            **kwargs,
        )

    producer = OnlineEvalProducer(db)
    producer._max_outstanding = 1
    assert await producer._admission_budget() == 1

    async with db() as session:
        session.add(_unit("ERROR", attempts=MAX_ATTEMPTS))
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
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    async with db() as session:
        session.add_all(
            [
                models.EvalWorkUnit(
                    span_rowid=span.id,
                    evaluator_id=evaluator_id,
                    criteria_id=criteria_id,
                    config_fingerprint=f"fp-{token_hex(8)}",
                )
                for _ in range(outstanding_count)
            ]
        )

    producer = OnlineEvalProducer(db)
    producer._max_outstanding = 3

    assert await producer._admission_budget() == expected_budget


async def test_unexpected_criteria_load_error_fails_closed(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An unexpected exception during criteria resolution (e.g. a transient DB
    error) must abort the tick without advancing the cursor — advancing would
    silently skip the window for the criteria that failed to load."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    cursor_id = await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    async def _transient_boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("transient version-lookup failure")

    monkeypatch.setattr(producer_module, "resolve_criteria_bulk", _transient_boom)

    producer = OnlineEvalProducer(db)
    with pytest.raises(RuntimeError, match="transient version-lookup failure"):
        await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == 0


async def test_uncompilable_filter_is_skipped_without_stalling(db: DbSessionFactory) -> None:
    """A filter_condition that fails to compile is a persistent per-criteria
    condition: the criteria is skipped (operator-visibly, via log) while the
    cursor still advances for the healthy criteria — one bad DSL string must
    not stall the shared cursor forever."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    good_evaluator_id, _ = await _seed_criteria(db, project.id)
    _, bad_criteria_id = await _seed_criteria(db, project.id, filter_condition="span_kind ==")
    cursor_id = await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    assert {unit.evaluator_id for unit in units} == {good_evaluator_id}
    assert bad_criteria_id not in {unit.criteria_id for unit in units}
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == span.id


async def test_lease_stand_down_and_stale_reclaim(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    observed_at = _now() - timedelta(seconds=120)
    cursor_id = await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=observed_at,
        claimed_by="rival-producer",
        claimed_at=_now(),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.claimed_by == "rival-producer"
    assert cursor.produced_through_id == 0

    async with db() as session:
        await session.execute(
            update(models.EvalWorkCursor)
            .where(models.EvalWorkCursor.id == cursor_id)
            .values(claimed_at=_now() - timedelta(seconds=300))
        )
    await producer._tick()

    cursor = await _get_cursor(db, cursor_id)
    assert cursor.claimed_by == producer._producer_id
    assert cursor.produced_through_id == span.id
    assert sorted(await _work_unit_span_rowids(db)) == [span.id]


async def test_lost_lease_rolls_back_materialization_and_aborts_tick(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    cursor_id = await _seed_cursor(
        db,
        produced_through_id=span.id - 1,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    insert_work_units = producer._insert_work_units

    async def _insert_then_lose_lease(
        session: Any,
        criteria: Any,
        span_ids: list[int],
    ) -> None:
        await insert_work_units(session, criteria, span_ids)
        await session.execute(
            update(models.EvalWorkCursor)
            .where(models.EvalWorkCursor.id == cursor_id)
            .values(claimed_by="rival-producer")
        )

    monkeypatch.setattr(producer, "_insert_work_units", _insert_then_lose_lease)

    with caplog.at_level("WARNING"):
        await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == span.id - 1
    assert cursor.claimed_by == producer._producer_id
    assert (
        sum("tick aborted after losing its lease" in record.message for record in caplog.records)
        == 1
    )


@pytest.mark.postgres_only
async def test_separate_lease_steal_rolls_back_truncated_frontier(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_OUTSTANDING", "1")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(2)]
    await _seed_criteria(db, project.id)
    cursor_id = await _seed_cursor(
        db,
        produced_through_id=spans[0].id - 1,
        observed_high_water_id=spans[-1].id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    insert_work_units = producer._insert_work_units

    async def _steal_then_insert(
        session: Any,
        criteria: Any,
        span_ids: list[int],
    ) -> None:
        async with db() as rival_session:
            await rival_session.execute(
                update(models.EvalWorkCursor)
                .where(models.EvalWorkCursor.id == cursor_id)
                .values(claimed_by="rival-producer")
            )
        await insert_work_units(session, criteria, span_ids)

    monkeypatch.setattr(producer, "_insert_work_units", _steal_then_insert)

    with caplog.at_level("WARNING"):
        await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    assert not producer._lease_held
    assert any("tick aborted after losing its lease" in record.message for record in caplog.records)


@pytest.mark.postgres_only
async def test_separate_lease_steal_rolls_back_backstop(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    cursor_id = await _seed_cursor(db, produced_through_id=span.id)

    producer = OnlineEvalProducer(db)
    producer._backstop_interval_seconds = 0
    insert_work_units = producer._insert_work_units

    async def _steal_then_insert(
        session: Any,
        criteria: Any,
        span_ids: list[int],
    ) -> None:
        async with db() as rival_session:
            await rival_session.execute(
                update(models.EvalWorkCursor)
                .where(models.EvalWorkCursor.id == cursor_id)
                .values(claimed_by="rival-producer")
            )
        await insert_work_units(session, criteria, span_ids)

    monkeypatch.setattr(producer, "_insert_work_units", _steal_then_insert)

    with caplog.at_level("WARNING"):
        await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    assert not producer._lease_held
    assert any("tick aborted after losing its lease" in record.message for record in caplog.records)


async def test_renew_lease_refreshes_claimed_at(db: DbSessionFactory) -> None:
    producer = OnlineEvalProducer(db)
    old = _now() - timedelta(seconds=60)
    cursor_id = await _seed_cursor(
        db,
        claimed_by=producer._producer_id,
        claimed_at=old,
    )
    renewed_at = _now()

    await producer._renew_lease(renewed_at)

    cursor = await _get_cursor(db, cursor_id)
    assert cursor.claimed_at == renewed_at


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
