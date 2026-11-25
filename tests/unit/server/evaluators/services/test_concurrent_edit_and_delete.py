import asyncio
from collections.abc import Coroutine
from secrets import token_hex
from types import SimpleNamespace
from typing import Any, Literal, Optional, cast

import pytest
from sqlalchemy import delete, event, func, select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.decisions import JsonState, PredicateQuestion
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
    TextContentPart,
)
from phoenix.server.api.exceptions import NotFound
from phoenix.server.app import _db
from phoenix.server.cleanup import lifecycle
from phoenix.server.cleanup.coordinator import CleanupCoordinator
from phoenix.server.dml_event import DmlEvent
from phoenix.server.evaluators.runtime.builtin import get_builtin_evaluators
from phoenix.server.evaluators.services import dataset_bindings, decisions, project_bindings
from phoenix.server.evaluators.services.definitions import EvaluatorServiceContext
from phoenix.server.evaluators.services.prompt_source import FromPromptVersion, NewPrompt
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import CanPutItem, DbSessionFactory
from tests.unit._helpers import _RecordingQueue


def _service_context(
    db: DbSessionFactory, *, event_queue: Optional[CanPutItem[DmlEvent]] = None
) -> EvaluatorServiceContext:
    return EvaluatorServiceContext(
        db=db,
        sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None)),
        event_queue=event_queue,
    )


def _output_configs(correct_score: float) -> list[Any]:
    return [
        CategoricalOutputConfig(
            type="CATEGORICAL",
            name="correctness",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            values=[
                CategoricalAnnotationValue(label="correct", score=correct_score),
                CategoricalAnnotationValue(label="incorrect", score=0.0),
            ],
        )
    ]


def _prompt_version() -> models.PromptVersion:
    return models.PromptVersion(
        template_type=PromptTemplateType.CHAT,
        template_format=PromptTemplateFormat.MUSTACHE,
        template=PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user", content=[TextContentPart(type="text", text="Judge {{output}}")]
                )
            ],
        ),
        invocation_parameters=PromptOpenAIInvocationParameters(
            type="openai", openai=PromptOpenAIInvocationParametersContent()
        ),
        model_provider=ModelProvider.OPENAI,
        model_name="gpt-4o-mini",
        metadata_={},
    )


async def _pinned_version(db: DbSessionFactory, evaluator_id: int) -> GlobalID:
    async with db() as session:
        version_id = await session.scalar(
            select(models.PromptVersionTag.prompt_version_id)
            .join(
                models.LLMEvaluator,
                models.LLMEvaluator.prompt_version_tag_id == models.PromptVersionTag.id,
            )
            .where(models.LLMEvaluator.id == evaluator_id)
        )
    return GlobalID("PromptVersion", str(version_id))


@pytest.mark.postgres_only
@pytest.mark.parametrize("target", ["dataset", "project"])
async def test_concurrent_edit_and_delete_of_one_binding_both_return(
    postgresql_engine: AsyncEngine, target: str
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    name = Identifier(f"race-{token_hex(4)}")
    mapping = InputMapping(literal_mapping={}, path_mapping={"output": "$.output"})
    binding: Any
    edit: Coroutine[Any, Any, Any]
    if target == "dataset":
        async with db() as session:
            dataset = models.Dataset(name=f"race-{token_hex(4)}", metadata_={})
            session.add(dataset)
            await session.flush()
        dataset_gid = GlobalID("Dataset", str(dataset.id))
        binding = await dataset_bindings.create_dataset_llm_evaluator(
            context,
            dataset_bindings.CreateDatasetLLMEvaluatorInput(
                dataset_id=dataset_gid,
                name=name,
                prompt_source=NewPrompt(_prompt_version()),
                output_configs=_output_configs(1.0),
                input_mapping=mapping,
            ),
        )
        binding_gid = GlobalID("DatasetEvaluator", str(binding.id))
        version_gid = await _pinned_version(db, binding.evaluator_id)
        edit = dataset_bindings.update_dataset_llm_evaluator(
            context,
            dataset_bindings.UpdateDatasetLLMEvaluatorInput(
                dataset_evaluator_id=binding_gid,
                dataset_id=dataset_gid,
                name=name,
                prompt_source=FromPromptVersion(version_gid),
                output_configs=_output_configs(0.9),
                input_mapping=mapping,
            ),
        )
        delete = dataset_bindings.delete_dataset_evaluators(
            context,
            dataset_bindings.DeleteDatasetEvaluatorsInput(dataset_evaluator_ids=[binding_gid]),
        )
        binding_model: Any = models.DatasetEvaluators
    else:
        async with db() as session:
            project = models.Project(name=f"race-{token_hex(4)}")
            session.add(project)
            await session.flush()
        binding = await project_bindings.create_project_llm_evaluator(
            context,
            project_bindings.CreateProjectLLMEvaluatorInput(
                project_id=GlobalID("Project", str(project.id)),
                name=name,
                prompt_source=NewPrompt(_prompt_version()),
                output_configs=_output_configs(1.0),
                input_mapping=mapping,
                sampling_rate=1.0,
                evaluation_target="TRACE",
            ),
        )
        binding_gid = GlobalID("ProjectEvaluator", str(binding.id))
        version_gid = await _pinned_version(db, binding.evaluator_id)
        edit = project_bindings.update_project_llm_evaluator(
            context,
            project_bindings.UpdateProjectLLMEvaluatorInput(
                project_evaluator_id=binding_gid,
                name=name,
                prompt_source=FromPromptVersion(version_gid),
                output_configs=_output_configs(0.9),
                input_mapping=mapping,
                sampling_rate=1.0,
                evaluation_target="TRACE",
                filter_condition="",
            ),
        )
        delete = project_bindings.delete_project_evaluators(
            context,
            project_bindings.DeleteProjectEvaluatorsInput(project_evaluator_ids=[binding_gid]),
        )
        binding_model = models.ProjectEvaluator

    edited, deleted = await asyncio.gather(edit, delete, return_exceptions=True)

    # The edit may lose the race and find nothing to edit; neither call fails the server.
    assert not isinstance(edited, BaseException) or isinstance(edited, NotFound), edited
    assert deleted == [binding_gid]
    async with db() as session:
        tombstoned = await session.get(binding_model, binding.id)
        assert tombstoned is not None and tombstoned.deleted_at is not None
        assert tombstoned.evaluator_id is None

    coordinator = CleanupCoordinator(db)
    while (await coordinator.step_or_next_delay())[0]:
        pass

    async with db() as session:
        assert await session.get(binding_model, binding.id) is None


@pytest.mark.postgres_only
async def test_dataset_attach_waits_for_owner_before_locking_evaluator(
    postgresql_engine: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    async with db() as session:
        dataset = models.Dataset(name=f"attach-order-{token_hex(4)}", metadata_={})
        session.add(dataset)
        await session.flush()
    dataset_id = GlobalID("Dataset", str(dataset.id))
    original = await dataset_bindings.create_dataset_llm_evaluator(
        context,
        dataset_bindings.CreateDatasetLLMEvaluatorInput(
            dataset_id=dataset_id,
            name=Identifier(f"original-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={"output": "$.output"}),
        ),
    )
    waiting_for_owner = asyncio.Event()
    lock_owner = dataset_bindings.lock_dataset_for_binding

    async def observed_lock(*args: Any, **kwargs: Any) -> models.Dataset:
        waiting_for_owner.set()
        return await lock_owner(*args, **kwargs)

    monkeypatch.setattr(dataset_bindings, "lock_dataset_for_binding", observed_lock)
    async with db() as session:
        await session.execute(
            select(models.Dataset.id).where(models.Dataset.id == dataset.id).with_for_update()
        )
        attach = asyncio.create_task(
            dataset_bindings.create_dataset_llm_binding(
                context,
                dataset_bindings.CreateDatasetLLMBindingInput(
                    dataset_id=dataset_id,
                    evaluator_id=GlobalID("LLMEvaluator", str(original.evaluator_id)),
                    name=Identifier(f"attached-{token_hex(4)}"),
                    input_mapping=InputMapping(
                        literal_mapping={}, path_mapping={"output": "$.output"}
                    ),
                ),
            )
        )
        await asyncio.wait_for(waiting_for_owner.wait(), 5)
        await _wait_until_lock_wait_or_done(db, attach, "FROM datasets")
        assert not attach.done()
        await session.execute(
            select(models.Evaluator.id)
            .where(models.Evaluator.id == original.evaluator_id)
            .with_for_update(nowait=True)
        )
    attached = await asyncio.wait_for(attach, 5)
    assert attached.dataset_id == dataset.id


def _create_decision_version(*, decision: models.Decision) -> models.DecisionVersion:
    return models.DecisionVersion(
        decision=decision,
        template_format=PromptTemplateFormat.MUSTACHE,
        state=JsonState(type="json", template="{{output}}"),
        questions=[
            PredicateQuestion(
                type="predicate",
                name="urgent",
                instructions="Is it urgent?",
            )
        ],
        model_provider=ModelProvider.TYPESAFE,
        model_name="jev-latest",
        metadata_={},
    )


async def test_create_decision_evaluator_raises_not_found_when_decision_deleted_before_flush(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    context = _service_context(db)
    async with db() as session:
        decision = models.Decision(name=Identifier(f"decision-{token_hex(4)}"), metadata_={})
        decision_version = _create_decision_version(decision=decision)
        session.add(decision_version)
        await session.flush()
        version_global_id = GlobalID("DecisionVersion", str(decision_version.id))

    load_version = decisions._version

    async def load_version_then_delete_decision(
        session: AsyncSession, version_id: GlobalID
    ) -> models.DecisionVersion:
        loaded_version = await load_version(session, version_id)
        await session.execute(
            delete(models.Decision).where(models.Decision.id == loaded_version.decision_id),
            execution_options={"synchronize_session": False},
        )
        return loaded_version

    monkeypatch.setattr(decisions, "_version", load_version_then_delete_decision)

    with pytest.raises(NotFound, match="Decision version not found"):
        await decisions.create_decision_evaluator(
            context,
            decisions.CreateDecisionEvaluatorInput(
                name=Identifier(f"judge-{token_hex(4)}"),
                decision_version_id=version_global_id,
            ),
        )


async def test_renaming_patch_raises_not_found_when_version_deleted_before_flush(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    context = _service_context(db)
    async with db() as session:
        decision = models.Decision(name=Identifier(f"decision-{token_hex(4)}"), metadata_={})
        initial_version = _create_decision_version(decision=decision)
        next_version = _create_decision_version(decision=decision)
        session.add_all([initial_version, next_version])
        await session.flush()
        initial_version_global_id = GlobalID("DecisionVersion", str(initial_version.id))
        next_version_global_id = GlobalID("DecisionVersion", str(next_version.id))

    evaluator = await decisions.create_decision_evaluator(
        context,
        decisions.CreateDecisionEvaluatorInput(
            name=Identifier(f"judge-{token_hex(4)}"),
            decision_version_id=initial_version_global_id,
        ),
    )
    evaluator_global_id = GlobalID("DecisionEvaluator", str(evaluator.id))

    load_version = decisions._version

    async def load_version_then_delete_version(
        session: AsyncSession, version_id: GlobalID
    ) -> models.DecisionVersion:
        loaded_version = await load_version(session, version_id)
        await session.execute(
            delete(models.DecisionVersion).where(models.DecisionVersion.id == loaded_version.id),
            execution_options={"synchronize_session": False},
        )
        return loaded_version

    monkeypatch.setattr(decisions, "_version", load_version_then_delete_version)

    with pytest.raises(NotFound, match="Decision version not found"):
        await decisions.patch_decision_evaluator(
            context,
            evaluator_global_id,
            decisions.DecisionEvaluatorPatch(
                name=Identifier(f"renamed-{token_hex(4)}"),
                decision_version_id=next_version_global_id,
            ),
        )


@pytest.mark.postgres_only
@pytest.mark.parametrize("target", ["project", "dataset"])
async def test_tombstone_evaluators_ignores_binding_committed_after_discovery(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
    target: str,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    mapping = InputMapping(literal_mapping={}, path_mapping={"output": "$.output"})

    async with db() as session:
        owner: models.Project | models.Dataset = (
            models.Project(name=f"disc-race-proj-{token_hex(4)}")
            if target == "project"
            else models.Dataset(name=f"disc-race-ds-{token_hex(4)}", metadata_={})
        )
        session.add(owner)
        await session.flush()
        owner_id = owner.id

    first_binding: models.ProjectEvaluator | models.DatasetEvaluators
    if target == "project":
        first_binding = await project_bindings.create_project_llm_evaluator(
            context,
            project_bindings.CreateProjectLLMEvaluatorInput(
                project_id=GlobalID("Project", str(owner_id)),
                name=Identifier(f"first-{token_hex(4)}"),
                prompt_source=NewPrompt(_prompt_version()),
                output_configs=_output_configs(1.0),
                input_mapping=mapping,
                sampling_rate=1.0,
                evaluation_target="TRACE",
            ),
        )
        binding_model: Any = models.ProjectEvaluator
        tombstone_bindings = lifecycle.tombstone_project_evaluators
    else:
        first_binding = await dataset_bindings.create_dataset_llm_evaluator(
            context,
            dataset_bindings.CreateDatasetLLMEvaluatorInput(
                dataset_id=GlobalID("Dataset", str(owner_id)),
                name=Identifier(f"first-{token_hex(4)}"),
                prompt_source=NewPrompt(_prompt_version()),
                output_configs=_output_configs(1.0),
                input_mapping=mapping,
            ),
        )
        binding_model = models.DatasetEvaluators
        tombstone_bindings = lifecycle.tombstone_dataset_evaluators

    commit_second_binding = asyncio.Event()
    second_binding_flushed = asyncio.Event()
    second_binding_committed = asyncio.Event()
    second_binding_ids: list[int] = []

    async def _stage_second_binding() -> None:
        async with db() as staging_session:
            trace_project = models.Project(name=f"disc-race-trace-{token_hex(4)}")
            staging_session.add(trace_project)
            await staging_session.flush()
            staged_binding: models.ProjectEvaluator | models.DatasetEvaluators
            if target == "project":
                staged_binding = models.ProjectEvaluator(
                    project_id=owner_id,
                    evaluator_id=first_binding.evaluator_id,
                    trace_project_id=trace_project.id,
                    name=Identifier(f"second-{token_hex(4)}"),
                    evaluation_target="TRACE",
                    filter_condition="",
                    sampling_rate=1.0,
                )
            else:
                staged_binding = models.DatasetEvaluators(
                    dataset_id=owner_id,
                    evaluator_id=first_binding.evaluator_id,
                    project_id=trace_project.id,
                    name=Identifier(f"second-{token_hex(4)}"),
                    input_mapping=mapping,
                )
            staging_session.add(staged_binding)
            await staging_session.flush()
            second_binding_ids.append(staged_binding.id)
            second_binding_flushed.set()
            await commit_second_binding.wait()
        second_binding_committed.set()

    stager_task = asyncio.create_task(_stage_second_binding())
    await asyncio.wait_for(second_binding_flushed.wait(), 5)
    second_binding_id = second_binding_ids[0]

    original_lock_projects = lifecycle._lock_projects

    async def _lock_projects_after_second_commits(*args: Any, **kwargs: Any) -> None:
        commit_second_binding.set()
        await asyncio.wait_for(second_binding_committed.wait(), 5)
        await original_lock_projects(*args, **kwargs)

    monkeypatch.setattr(lifecycle, "_lock_projects", _lock_projects_after_second_commits)

    async with db() as delete_session:
        await tombstone_bindings(
            delete_session,
            binding_ids=[first_binding.id, second_binding_id],
            collect_unused_evaluator=False,
            delete_associated_prompt=False,
        )
    await asyncio.wait_for(stager_task, 5)

    async with db() as verify_session:
        first_after = await verify_session.get(binding_model, first_binding.id)
        second_after = await verify_session.get(binding_model, second_binding_id)
        assert first_after is not None and first_after.deleted_at is not None
        assert second_after is not None and second_after.deleted_at is None


@pytest.mark.postgres_only
async def test_concurrent_tombstone_project_and_persist_evaluator_traces(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.server.online_eval.tracing import persist_evaluator_traces
    from phoenix.tracers import Tracer

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    async with db() as session:
        owner_project = models.Project(name=f"deadlock1-proj-{token_hex(4)}")
        session.add(owner_project)
        await session.flush()
        owner_project_id = owner_project.id

    binding = await project_bindings.create_project_llm_evaluator(
        context,
        project_bindings.CreateProjectLLMEvaluatorInput(
            project_id=GlobalID("Project", str(owner_project_id)),
            name=Identifier(f"eval-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={"output": "$.output"}),
            sampling_rate=1.0,
            evaluation_target="TRACE",
            tracing_enabled=True,
        ),
    )

    tracer = Tracer(span_cost_calculator=cast(Any, None))
    with tracer.start_as_current_span("evaluator-span"):
        pass

    trace_locked_binding = asyncio.Event()
    delete_locked_projects = asyncio.Event()
    original_lock_projects = lifecycle._lock_projects
    original_async_flush = AsyncSession.flush

    async def _coordinated_flush(
        self_session: AsyncSession, *flush_args: Any, **flush_kwargs: Any
    ) -> None:
        if any(isinstance(obj, models.Trace) for obj in self_session.new):
            trace_locked_binding.set()
            await asyncio.wait_for(delete_locked_projects.wait(), 5)
        await original_async_flush(self_session, *flush_args, **flush_kwargs)

    async def _lock_projects_and_release(*args: Any, **kwargs: Any) -> None:
        await original_lock_projects(*args, **kwargs)
        delete_locked_projects.set()

    monkeypatch.setattr(lifecycle, "_lock_projects", _lock_projects_and_release)
    monkeypatch.setattr(AsyncSession, "flush", _coordinated_flush)

    async def _run_tombstone_project() -> None:
        await asyncio.wait_for(trace_locked_binding.wait(), 5)
        async with db() as delete_session:
            await lifecycle.tombstone_project(
                delete_session,
                project_id=owner_project_id,
            )

    await asyncio.gather(
        persist_evaluator_traces(
            db=db,
            tracer=tracer,
            project_evaluator_id=binding.id,
        ),
        _run_tombstone_project(),
    )

    async with db() as session:
        tombstoned_owner = await session.get(models.Project, owner_project_id)
        assert tombstoned_owner is not None and tombstoned_owner.deleted_at is not None
        tombstoned_binding = await session.get(models.ProjectEvaluator, binding.id)
        assert tombstoned_binding is not None and tombstoned_binding.deleted_at is not None
        tombstoned_trace_project = await session.get(models.Project, binding.trace_project_id)
        assert tombstoned_trace_project is not None
        assert tombstoned_trace_project.deleted_at is not None
        num_persisted_traces = await session.scalar(
            select(func.count())
            .select_from(models.Trace)
            .where(models.Trace.project_rowid == binding.trace_project_id)
        )
        assert num_persisted_traces == 1


@pytest.mark.postgres_only
async def test_tombstone_exclusive_experiment_projects_locks_all_evaluators_in_one_ordered_statement(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.server.evaluators.services import definitions as definitions_module
    from phoenix.server.evaluators.services.management import (
        lock_evaluators as original_lock_evaluators,
    )

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    async with db() as session:
        prompt = models.Prompt(
            name=Identifier(f"prompt-dl2-{token_hex(4)}"),
            prompt_versions=[_prompt_version()],
        )
        first_exp_project = models.Project(name=f"exp-proj-1-{token_hex(4)}")
        second_exp_project = models.Project(name=f"exp-proj-2-{token_hex(4)}")
        session.add_all([prompt, first_exp_project, second_exp_project])
        await session.flush()
        prompt_version_id = prompt.prompt_versions[0].id
        first_exp_project_id = first_exp_project.id
        second_exp_project_id = second_exp_project.id
        exp_project_names = [first_exp_project.name, second_exp_project.name]

    lower_evaluator = await definitions_module.create_llm_evaluator(
        context,
        definitions_module.CreateLLMEvaluatorInput(
            name=Identifier(f"eval-low-{token_hex(4)}"),
            prompt_version_id=GlobalID("PromptVersion", str(prompt_version_id)),
            output_configs=_output_configs(1.0),
        ),
    )
    higher_evaluator = await definitions_module.create_llm_evaluator(
        context,
        definitions_module.CreateLLMEvaluatorInput(
            name=Identifier(f"eval-high-{token_hex(4)}"),
            prompt_version_id=GlobalID("PromptVersion", str(prompt_version_id)),
            output_configs=_output_configs(1.0),
        ),
    )
    assert lower_evaluator.id < higher_evaluator.id

    mapping = InputMapping(literal_mapping={}, path_mapping={"output": "$.output"})
    await project_bindings.add_project_evaluator(
        context,
        GlobalID("LLMEvaluator", str(higher_evaluator.id)),
        project_bindings.ProjectBindingSettings(
            project_id=GlobalID("Project", str(first_exp_project_id)),
            name=Identifier(f"bind-high-{token_hex(4)}"),
            sampling_rate=1.0,
            evaluation_target="TRACE",
            input_mapping=mapping,
        ),
    )
    await project_bindings.add_project_evaluator(
        context,
        GlobalID("LLMEvaluator", str(lower_evaluator.id)),
        project_bindings.ProjectBindingSettings(
            project_id=GlobalID("Project", str(second_exp_project_id)),
            name=Identifier(f"bind-low-{token_hex(4)}"),
            sampling_rate=1.0,
            evaluation_target="TRACE",
            input_mapping=mapping,
        ),
    )

    locked_evaluator_batches: list[set[int]] = []
    evaluator_lock_statements: list[str] = []

    async def _record_lock_evaluators(lock_session: AsyncSession, evaluator_ids: Any) -> None:
        if batch := set(evaluator_ids):
            locked_evaluator_batches.append(batch)
        await original_lock_evaluators(lock_session, evaluator_ids)

    def _record_statement(
        _connection: Any, _cursor: Any, statement: str, *_args: Any, **_kwargs: Any
    ) -> None:
        if "FROM evaluators" in statement and "FOR UPDATE" in statement:
            evaluator_lock_statements.append(statement)

    monkeypatch.setattr(lifecycle, "lock_evaluators", _record_lock_evaluators)
    event.listen(postgresql_engine.sync_engine, "before_cursor_execute", _record_statement)

    async with db() as delete_session:
        candidate_project_ids = await lifecycle.resolve_experiment_project_delete_candidates(
            delete_session, candidate_project_names=exp_project_names
        )
        tombstoned_ids = await lifecycle.tombstone_exclusive_experiment_projects(
            delete_session,
            candidate_project_ids=candidate_project_ids,
        )

    event.remove(postgresql_engine.sync_engine, "before_cursor_execute", _record_statement)

    # The evaluators bound to lower- and higher-id projects are in opposite id order, so one
    # statement that orders by evaluator id is what keeps their lock order canonical.
    assert locked_evaluator_batches == [{lower_evaluator.id, higher_evaluator.id}]
    assert len(evaluator_lock_statements) == 1
    assert "ORDER BY evaluators.id" in evaluator_lock_statements[0]
    assert len(tombstoned_ids) == 4


async def _wait_until_lock_wait_or_done(
    db: DbSessionFactory,
    task: "asyncio.Task[Any]",
    query_fragment: str,
) -> None:
    """Return once PostgreSQL parks ``task``'s query on a row lock.

    A task that finishes without ever waiting fails the caller, and one that never settles is
    cancelled so it cannot leak its sessions.
    """
    from sqlalchemy import text

    async def _cancel_pending_task() -> None:
        if not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    deadline = asyncio.get_running_loop().time() + 5.0
    while not task.done():
        async with db() as observer_session:
            is_waiting_on_lock = await observer_session.scalar(
                text(
                    "SELECT EXISTS ("
                    "  SELECT 1 FROM pg_stat_activity"
                    "  WHERE datname = current_database()"
                    "    AND wait_event_type = 'Lock'"
                    "    AND query LIKE :pattern"
                    ")"
                ),
                {"pattern": f"%{query_fragment}%"},
            )
        if is_waiting_on_lock:
            return
        if asyncio.get_running_loop().time() >= deadline:
            await _cancel_pending_task()
            raise TimeoutError(f"Timed out waiting for lock wait on {query_fragment!r}")
        await asyncio.sleep(0.01)
    raise AssertionError(f"the task finished without waiting on a lock for {query_fragment!r}")


@pytest.mark.postgres_only
async def test_persisting_eval_traces_finishes_while_a_dataset_evaluator_delete_holds_its_locks(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from datetime import datetime, timezone

    from phoenix.server.daemons.experiment_runner import EvalWorkItem
    from phoenix.server.evaluators.services.management import (
        lock_evaluators as original_lock_evaluators,
    )

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    now_time = datetime.now(timezone.utc)
    async with db() as session:
        dataset = models.Dataset(name=f"exp-dl3-{token_hex(4)}", metadata_={})
        session.add(dataset)
        await session.flush()
        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        dataset_example = models.DatasetExample(dataset_id=dataset.id)
        session.add_all([dataset_version, dataset_example])
        await session.flush()
        example_revision = models.DatasetExampleRevision(
            dataset_example_id=dataset_example.id,
            dataset_version_id=dataset_version.id,
            input={"question": "hi"},
            output={"answer": "hello"},
            metadata_={},
            revision_kind="CREATE",
        )
        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
        )
        session.add_all([example_revision, experiment])
        await session.flush()
        experiment_run = models.ExperimentRun(
            experiment_id=experiment.id,
            dataset_example_id=dataset_example.id,
            repetition_number=1,
            output={"output": "hello"},
            start_time=now_time,
            end_time=now_time,
        )
        session.add(experiment_run)
        await session.flush()
        dataset_id = dataset.id

    dataset_binding = await dataset_bindings.create_dataset_llm_evaluator(
        context,
        dataset_bindings.CreateDatasetLLMEvaluatorInput(
            dataset_id=GlobalID("Dataset", str(dataset_id)),
            name=Identifier(f"ds-eval-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={"output": "$.output"}),
        ),
    )

    work_item = object.__new__(EvalWorkItem)
    work_item._db = db
    work_item._dataset_evaluator_id = dataset_binding.id
    work_item._experiment_run = experiment_run

    project_locked_by_delete = asyncio.Event()
    release_delete_binding_lock = asyncio.Event()

    async def _pause_before_binding_lock(lock_session: AsyncSession, evaluator_ids: Any) -> None:
        await original_lock_evaluators(lock_session, evaluator_ids)
        project_locked_by_delete.set()
        await asyncio.wait_for(release_delete_binding_lock.wait(), 5)

    monkeypatch.setattr(lifecycle, "lock_evaluators", _pause_before_binding_lock)

    eval_trace = models.Trace(
        project_rowid=dataset_binding.project_id,
        trace_id=token_hex(16),
        start_time=now_time,
        end_time=now_time,
    )

    async def _run_delete() -> None:
        async with db() as delete_session:
            await lifecycle.tombstone_dataset_evaluators(
                delete_session,
                binding_ids=[dataset_binding.id],
                collect_unused_evaluator=False,
                delete_associated_prompt=False,
            )

    async def _run_persist() -> None:
        await asyncio.wait_for(project_locked_by_delete.wait(), 5)
        try:
            # The persist locks only the binding row, so it must not wait for the project lock.
            await asyncio.wait_for(
                work_item._persist_eval_results(annotations=[], db_traces=[eval_trace]), 5
            )
        finally:
            release_delete_binding_lock.set()

    await asyncio.gather(_run_delete(), _run_persist())


@pytest.mark.postgres_only
async def test_patch_llm_evaluator_does_not_lock_prompt_versions_for_update(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.server.evaluators.services import definitions as definitions_module
    from phoenix.server.evaluators.services.prompt_source import (
        EditCurrentPrompt,
    )
    from phoenix.server.evaluators.services.prompt_source import (
        pin_prompt_version as original_pin_prompt_version,
    )

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    async with db() as session:
        prompt = models.Prompt(
            name=Identifier(f"prompt-dl4-{token_hex(4)}"),
            prompt_versions=[_prompt_version()],
        )
        session.add(prompt)
        await session.flush()
        prompt_version_id = prompt.prompt_versions[0].id

    evaluator = await definitions_module.create_llm_evaluator(
        context,
        definitions_module.CreateLLMEvaluatorInput(
            name=Identifier(f"llm-dl4-{token_hex(4)}"),
            prompt_version_id=GlobalID("PromptVersion", str(prompt_version_id)),
            output_configs=_output_configs(1.0),
        ),
    )

    evaluator_locked = asyncio.Event()
    checked_prompt_version_lock = asyncio.Event()

    async def _paused_pin_prompt_version(*args: Any, **kwargs: Any) -> models.PromptVersion:
        evaluator_locked.set()
        await asyncio.wait_for(checked_prompt_version_lock.wait(), 5)
        return await original_pin_prompt_version(*args, **kwargs)

    monkeypatch.setattr(definitions_module, "pin_prompt_version", _paused_pin_prompt_version)

    async def _assert_prompt_version_not_locked_for_update() -> None:
        await asyncio.wait_for(evaluator_locked.wait(), 5)
        try:
            async with db() as probe_session:
                # On migrated databases where prompt_versions ON DELETE CASCADE runs before
                # llm_evaluators ON DELETE RESTRICT, holding FOR UPDATE on prompt_versions here
                # deadlocks (40P01) with DELETE FROM prompts when pin_prompt_version flushes.
                await probe_session.execute(
                    select(models.PromptVersion.id)
                    .where(models.PromptVersion.id == prompt_version_id)
                    .with_for_update(nowait=True)
                )
        finally:
            checked_prompt_version_lock.set()

    await asyncio.gather(
        definitions_module.patch_llm_evaluator(
            context,
            GlobalID("LLMEvaluator", str(evaluator.id)),
            definitions_module.LLMEvaluatorPatch(
                prompt_source=EditCurrentPrompt(_prompt_version()),
            ),
        ),
        _assert_prompt_version_not_locked_for_update(),
    )


@pytest.mark.postgres_only
async def test_delete_decision_locks_the_row_before_checking_references(
    postgresql_engine: AsyncEngine,
) -> None:
    from phoenix.server.api.exceptions import Conflict
    from phoenix.server.api.mutations.saved_decision_mutations import (
        DeleteDecisionInput,
        SavedDecisionMutationMixin,
    )

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    info = cast(Any, SimpleNamespace(context=SimpleNamespace(db=db)))
    async with db() as session:
        decision = models.Decision(name=Identifier(f"dec-lock-{token_hex(4)}"), metadata_={})
        session.add(_create_decision_version(decision=decision))
        await session.flush()
        decision_id = decision.id
        version_id = await session.scalar(
            select(models.DecisionVersion.id).where(
                models.DecisionVersion.decision_id == decision_id
            )
        )

    delete_task_coroutine = SavedDecisionMutationMixin().delete_decision(
        info, DeleteDecisionInput(decision_id=GlobalID("Decision", str(decision_id)))
    )
    async with db() as key_share_session:
        await key_share_session.execute(
            select(models.Decision.id)
            .where(models.Decision.id == decision_id)
            .with_for_update(read=True, key_share=True)
        )
        delete_task = asyncio.create_task(delete_task_coroutine)
        await _wait_until_lock_wait_or_done(db, delete_task, "SELECT decisions.id \nFROM decisions")
        assert not delete_task.done()
        await decisions.create_decision_evaluator(
            context,
            decisions.CreateDecisionEvaluatorInput(
                name=Identifier(f"referrer-{token_hex(4)}"),
                decision_version_id=GlobalID("DecisionVersion", str(version_id)),
            ),
        )
    # The evaluator committed while the delete waited, so only a check made after taking
    # the lock reports it by name; an earlier check falls through to the foreign-key fallback.
    with pytest.raises(Conflict, match=r"is referenced by an evaluator \(referrer-"):
        await asyncio.wait_for(delete_task, 5)


@pytest.mark.postgres_only
async def test_delete_project_evaluator_skips_surviving_prompt_lock(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    mapping = InputMapping(literal_mapping={}, path_mapping={"output": "$.output"})
    async with db() as session:
        first_project = models.Project(name=f"shared-p1-{token_hex(4)}")
        second_project = models.Project(name=f"shared-p2-{token_hex(4)}")
        session.add_all([first_project, second_project])
        await session.flush()
        first_project_id = first_project.id
        second_project_id = second_project.id

    sole_binding = await project_bindings.create_project_llm_evaluator(
        context,
        project_bindings.CreateProjectLLMEvaluatorInput(
            project_id=GlobalID("Project", str(first_project_id)),
            name=Identifier(f"sole-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=mapping,
            sampling_rate=1.0,
            evaluation_target="TRACE",
        ),
    )
    first_shared_binding = await project_bindings.create_project_llm_evaluator(
        context,
        project_bindings.CreateProjectLLMEvaluatorInput(
            project_id=GlobalID("Project", str(first_project_id)),
            name=Identifier(f"shared-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=mapping,
            sampling_rate=1.0,
            evaluation_target="TRACE",
        ),
    )
    assert first_shared_binding.evaluator_id is not None
    await project_bindings.add_project_evaluator(
        context,
        GlobalID("LLMEvaluator", str(first_shared_binding.evaluator_id)),
        project_bindings.ProjectBindingSettings(
            project_id=GlobalID("Project", str(second_project_id)),
            name=Identifier(f"shared-copy-{token_hex(4)}"),
            sampling_rate=1.0,
            evaluation_target="TRACE",
            input_mapping=mapping,
        ),
    )
    async with db() as session:
        shared_prompt_id = await session.scalar(
            select(models.LLMEvaluator.prompt_id).where(
                models.LLMEvaluator.id == first_shared_binding.evaluator_id
            )
        )
        assert shared_prompt_id is not None

    async with db() as prompt_lock_session:
        await prompt_lock_session.execute(
            select(models.Prompt.id).where(models.Prompt.id == shared_prompt_id).with_for_update()
        )
        delete_task = asyncio.create_task(
            project_bindings.delete_project_evaluators(
                context,
                project_bindings.DeleteProjectEvaluatorsInput(
                    project_evaluator_ids=[
                        GlobalID("ProjectEvaluator", str(sole_binding.id)),
                        GlobalID("ProjectEvaluator", str(first_shared_binding.id)),
                    ],
                    delete_associated_prompt=True,
                ),
            )
        )
        await asyncio.wait_for(delete_task, 5)


async def test_delete_project_evaluator_emits_tombstone_events(
    db: DbSessionFactory,
) -> None:
    from phoenix.server.dml_event import ProjectDeleteEvent, SpanDeleteEvent

    event_queue = _RecordingQueue()

    context = _service_context(db, event_queue=event_queue)
    async with db() as session:
        owner_project = models.Project(name=f"evt-p1-{token_hex(4)}")
        session.add(owner_project)
        await session.flush()
        owner_project_id = owner_project.id

    binding = await project_bindings.create_project_llm_evaluator(
        context,
        project_bindings.CreateProjectLLMEvaluatorInput(
            project_id=GlobalID("Project", str(owner_project_id)),
            name=Identifier(f"evt-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={"output": "$.output"}),
            sampling_rate=1.0,
            evaluation_target="TRACE",
        ),
    )
    await project_bindings.delete_project_evaluators(
        context,
        project_bindings.DeleteProjectEvaluatorsInput(
            project_evaluator_ids=[GlobalID("ProjectEvaluator", str(binding.id))],
        ),
    )
    assert SpanDeleteEvent((binding.trace_project_id,)) in event_queue.events
    assert ProjectDeleteEvent((binding.trace_project_id,)) in event_queue.events


@pytest.mark.postgres_only
async def test_concurrent_sync_builtin_evaluators_no_unique_violation(
    postgresql_engine: AsyncEngine,
) -> None:
    from phoenix.server.evaluators.services.builtin_sync import sync_builtin_evaluators

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        await session.execute(delete(models.Evaluator).where(models.Evaluator.kind == "BUILTIN"))

    await asyncio.gather(*(sync_builtin_evaluators(db) for _ in range(4)))

    async with db() as session:
        synced_builtin_keys = (await session.scalars(select(models.BuiltinEvaluator.key))).all()
        assert sorted(synced_builtin_keys) == sorted(key for key, _ in get_builtin_evaluators())


@pytest.mark.postgres_only
async def test_dataset_delete_keeps_project_of_experiment_a_user_deleted_first(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        kept_project = models.Project(name=f"kept-project-{token_hex(4)}")
        removed_project = models.Project(name=f"removed-project-{token_hex(4)}")
        dataset = models.Dataset(name=f"kept-ds-{token_hex(4)}", metadata_={})
        session.add_all([kept_project, removed_project, dataset])
        await session.flush()
        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add(dataset_version)
        await session.flush()
        kept_experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
            project_name=kept_project.name,
        )
        removed_experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
            project_name=removed_project.name,
        )
        session.add_all([kept_experiment, removed_experiment])
        await session.flush()
        dataset_id = dataset.id
        kept_project_id = kept_project.id
        removed_project_id = removed_project.id
        kept_experiment_id = kept_experiment.id
        removed_experiment_id = removed_experiment.id

    original_lock = lifecycle.lock_dataset_delete_targets

    async def _lock_then_let_user_delete(*args: Any, **kwargs: Any) -> Any:
        locked = await original_lock(*args, **kwargs)
        async with db() as user_session:
            await user_session.execute(
                delete(models.Experiment).where(models.Experiment.id == kept_experiment_id)
            )
        return locked

    monkeypatch.setattr(lifecycle, "lock_dataset_delete_targets", _lock_then_let_user_delete)
    async with db() as session:
        await lifecycle.delete_dataset_and_tombstone_projects(session, dataset_id=dataset_id)

    async with db() as session:
        assert await session.get(models.Dataset, dataset_id) is None
        assert await session.get(models.Experiment, removed_experiment_id) is None
        assert await session.get(models.Experiment, kept_experiment_id) is None
        kept = await session.get(models.Project, kept_project_id)
        removed = await session.get(models.Project, removed_project_id)
        assert kept is not None and kept.deleted_at is None
        assert removed is not None and removed.deleted_at is not None


@pytest.mark.postgres_only
async def test_delete_dataset_locks_experiment_projects_before_evaluators_and_emits_events(
    postgresql_engine: AsyncEngine,
) -> None:
    from phoenix.server.api.input_types.DeleteDatasetInput import DeleteDatasetInput
    from phoenix.server.api.mutations.dataset_mutations import DatasetMutationMixin
    from phoenix.server.dml_event import ProjectDeleteEvent, SpanDeleteEvent

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    event_queue = _RecordingQueue()
    context = _service_context(db, event_queue=event_queue)
    mapping = InputMapping(literal_mapping={}, path_mapping={"output": "$.output"})
    async with db() as session:
        dataset = models.Dataset(name=f"ds-del-order-{token_hex(4)}", metadata_={})
        exp_project = models.Project(name=f"exp-proj-{token_hex(4)}")
        session.add_all([dataset, exp_project])
        await session.flush()
        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add(dataset_version)
        await session.flush()
        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
            project_name=exp_project.name,
        )
        session.add(experiment)
        await session.flush()
        dataset_id = dataset.id
        exp_project_id = exp_project.id

    dataset_binding = await dataset_bindings.create_dataset_llm_evaluator(
        context,
        dataset_bindings.CreateDatasetLLMEvaluatorInput(
            dataset_id=GlobalID("Dataset", str(dataset_id)),
            name=Identifier(f"ds-eval-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=mapping,
        ),
    )
    assert dataset_binding.evaluator_id is not None
    exp_binding = await project_bindings.create_project_llm_evaluator(
        context,
        project_bindings.CreateProjectLLMEvaluatorInput(
            project_id=GlobalID("Project", str(exp_project_id)),
            name=Identifier(f"exp-eval-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=mapping,
            sampling_rate=1.0,
            evaluation_target="TRACE",
        ),
    )

    info = SimpleNamespace(
        context=SimpleNamespace(
            db=db,
            event_queue=event_queue,
        )
    )
    mixin = DatasetMutationMixin()

    async with db() as project_lock_session:
        await project_lock_session.execute(
            select(models.Project.id)
            .where(models.Project.id == exp_project_id)
            .with_for_update(key_share=True)
        )
        delete_task = asyncio.create_task(
            mixin.delete_dataset(
                cast(Any, info),
                DeleteDatasetInput(dataset_id=GlobalID("Dataset", str(dataset_id))),
            )
        )
        await _wait_until_lock_wait_or_done(db, delete_task, "FROM projects")
        assert not delete_task.done()
        # Evaluator lock must NOT be held yet while delete_dataset waits on exp_project!
        await project_lock_session.execute(
            select(models.Evaluator.id)
            .where(models.Evaluator.id == dataset_binding.evaluator_id)
            .with_for_update(nowait=True)
        )

    await asyncio.wait_for(delete_task, 5)
    expected_project_ids = tuple(
        sorted({dataset_binding.project_id, exp_project_id, exp_binding.trace_project_id})
    )
    assert SpanDeleteEvent(expected_project_ids) in event_queue.events
    assert ProjectDeleteEvent(expected_project_ids) in event_queue.events


@pytest.mark.postgres_only
async def test_delete_project_handles_lower_slipped_trace_project_and_emits_child_events(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.server.api.mutations.project_mutations import ProjectMutationMixin
    from phoenix.server.dml_event import ProjectDeleteEvent, SpanDeleteEvent

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    event_queue = _RecordingQueue()
    context = _service_context(db, event_queue=event_queue)
    mapping = InputMapping(literal_mapping={}, path_mapping={"output": "$.output"})
    # Allocate lower_trace_project FIRST so lower_trace_project.id < existing_binding.trace_project_id!
    async with db() as session:
        owner_project = models.Project(name=f"owner-proj-{token_hex(4)}")
        lower_trace_project = models.Project(name=f"lower-trace-{token_hex(4)}")
        session.add_all([owner_project, lower_trace_project])
        await session.flush()
        owner_project_id = owner_project.id
        lower_trace_project_id = lower_trace_project.id

    existing_binding = await project_bindings.create_project_llm_evaluator(
        context,
        project_bindings.CreateProjectLLMEvaluatorInput(
            project_id=GlobalID("Project", str(owner_project_id)),
            name=Identifier(f"higher-eval-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=mapping,
            sampling_rate=1.0,
            evaluation_target="TRACE",
        ),
    )
    assert lower_trace_project_id < existing_binding.trace_project_id

    commit_slipped_binding = asyncio.Event()
    slipped_flushed = asyncio.Event()
    slipped_committed = asyncio.Event()

    async def _stage_slipped_binding() -> None:
        async with db() as staging_session:
            slipped_binding = models.ProjectEvaluator(
                project_id=owner_project_id,
                evaluator_id=existing_binding.evaluator_id,
                trace_project_id=lower_trace_project_id,
                name=Identifier(f"slipped-{token_hex(4)}"),
                evaluation_target="TRACE",
                filter_condition="",
                sampling_rate=1.0,
            )
            staging_session.add(slipped_binding)
            await staging_session.flush()
            slipped_flushed.set()
            await commit_slipped_binding.wait()
        slipped_committed.set()

    stager_task = asyncio.create_task(_stage_slipped_binding())
    await asyncio.wait_for(slipped_flushed.wait(), 5)

    original_lock_projects = lifecycle._lock_projects
    first_call = True

    async def _commit_slipped_before_first_lock(*args: Any, **kwargs: Any) -> None:
        nonlocal first_call
        if first_call:
            first_call = False
            commit_slipped_binding.set()
            await asyncio.wait_for(slipped_committed.wait(), 5)
        await original_lock_projects(*args, **kwargs)

    monkeypatch.setattr(lifecycle, "_lock_projects", _commit_slipped_before_first_lock)

    original_lock_additional_projects = lifecycle._lock_additional_projects
    num_lower_project_probes = 0

    async def _lock_additional_projects_then_probe(
        lock_session: AsyncSession, *, locked_project_ids: set[int], target_project_ids: Any
    ) -> None:
        nonlocal num_lower_project_probes
        await original_lock_additional_projects(
            lock_session,
            locked_project_ids=locked_project_ids,
            target_project_ids=list(target_project_ids),
        )
        async with db() as probe_session:
            with pytest.raises(DBAPIError):
                await probe_session.execute(
                    select(models.Project.id)
                    .where(models.Project.id == lower_trace_project_id)
                    .with_for_update(nowait=True)
                )
        num_lower_project_probes += 1

    monkeypatch.setattr(
        lifecycle, "_lock_additional_projects", _lock_additional_projects_then_probe
    )

    info = SimpleNamespace(
        context=SimpleNamespace(
            db=db,
            event_queue=event_queue,
        )
    )
    mixin = ProjectMutationMixin()
    await mixin.delete_project(cast(Any, info), GlobalID("Project", str(owner_project_id)))
    await asyncio.wait_for(stager_task, 5)

    expected_project_ids = tuple(
        sorted({owner_project_id, lower_trace_project_id, existing_binding.trace_project_id})
    )
    assert num_lower_project_probes == 1
    assert SpanDeleteEvent(expected_project_ids) in event_queue.events
    assert ProjectDeleteEvent(expected_project_ids) in event_queue.events


@pytest.mark.postgres_only
async def test_patch_decision_evaluator_does_not_lock_decision_versions(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    async with db() as session:
        decision = models.Decision(name=Identifier(f"dec-dl4-{token_hex(4)}"), metadata_={})
        initial_version = _create_decision_version(decision=decision)
        next_version = _create_decision_version(decision=decision)
        session.add_all([initial_version, next_version])
        await session.flush()
        initial_version_id = initial_version.id
        next_version_id = next_version.id

    evaluator = await decisions.create_decision_evaluator(
        context,
        decisions.CreateDecisionEvaluatorInput(
            name=Identifier(f"judge-dl4-{token_hex(4)}"),
            decision_version_id=GlobalID("DecisionVersion", str(initial_version_id)),
        ),
    )

    evaluator_locked = asyncio.Event()
    checked_version_lock = asyncio.Event()
    original_load_version = decisions._version

    async def _paused_load_version(
        load_session: AsyncSession, version_gid: GlobalID
    ) -> models.DecisionVersion:
        evaluator_locked.set()
        await asyncio.wait_for(checked_version_lock.wait(), 5)
        return await original_load_version(load_session, version_gid)

    monkeypatch.setattr(decisions, "_version", _paused_load_version)

    async def _assert_decision_version_not_locked() -> None:
        await asyncio.wait_for(evaluator_locked.wait(), 5)
        try:
            async with db() as probe_session:
                await probe_session.execute(
                    select(models.DecisionVersion.id)
                    .where(models.DecisionVersion.id == initial_version_id)
                    .with_for_update(nowait=True)
                )
        finally:
            checked_version_lock.set()

    await asyncio.gather(
        decisions.patch_decision_evaluator(
            context,
            GlobalID("DecisionEvaluator", str(evaluator.id)),
            decisions.DecisionEvaluatorPatch(
                decision_version_id=GlobalID("DecisionVersion", str(next_version_id)),
            ),
        ),
        _assert_decision_version_not_locked(),
    )


@pytest.mark.postgres_only
async def test_tombstone_project_rejects_a_project_deleted_after_it_was_loaded(
    postgresql_engine: AsyncEngine,
) -> None:

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        project = models.Project(name=f"loaded-then-deleted-{token_hex(4)}")
        session.add(project)
        await session.flush()
        project_id = project.id

    async with db() as late_session:
        loaded_project = await late_session.get(models.Project, project_id)
        assert loaded_project is not None and loaded_project.deleted_at is None
        async with db() as first_session:
            await lifecycle.tombstone_project(first_session, project_id=project_id)
        with pytest.raises(NotFound):
            await lifecycle.tombstone_project(late_session, project_id=project_id)


@pytest.mark.postgres_only
@pytest.mark.parametrize("entry_point", ["sweeper", "rest", "graphql"])
async def test_experiment_delete_does_not_deadlock_with_dataset_delete(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
    entry_point: Literal["sweeper", "rest", "graphql"],
) -> None:
    from datetime import datetime, timedelta, timezone
    from unittest.mock import AsyncMock

    from phoenix.config import EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS
    from phoenix.db.helpers import get_sqlstate
    from phoenix.server.api.input_types.DeleteExperimentsInput import DeleteExperimentsInput
    from phoenix.server.api.mutations import experiment_mutations
    from phoenix.server.api.routers.v1 import experiments as experiments_router
    from phoenix.server.daemons import experiment_sweeper
    from phoenix.server.daemons.experiment_sweeper import ExperimentSweeper

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    expired_at = datetime.now(timezone.utc) - timedelta(
        hours=EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS + 1
    )
    async with db() as session:
        project = models.Project(name=f"exp-project-{token_hex(4)}")
        dataset = models.Dataset(name=f"exp-dl4-{token_hex(4)}", metadata_={})
        session.add_all([project, dataset])
        await session.flush()
        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add(dataset_version)
        await session.flush()
        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
            project_name=project.name,
            is_ephemeral=True,
            updated_at=expired_at,
        )
        session.add(experiment)
        await session.flush()
        project_id = project.id
        dataset_id = dataset.id
        experiment_id = experiment.id

    experiments_deleted = asyncio.Event()
    release_experiment_delete = asyncio.Event()
    original_tombstone = lifecycle.tombstone_exclusive_experiment_projects

    async def _pause_before_tombstone(*args: Any, **kwargs: Any) -> list[int]:
        experiments_deleted.set()
        await asyncio.wait_for(release_experiment_delete.wait(), 5)
        return await original_tombstone(*args, **kwargs)

    experiment_global_id = GlobalID("Experiment", str(experiment_id))
    experiment_runner = SimpleNamespace(stop_experiment=AsyncMock())
    event_queue = _RecordingQueue()

    async def _run_experiment_delete() -> None:
        if entry_point == "sweeper":
            monkeypatch.setattr(
                experiment_sweeper,
                "tombstone_exclusive_experiment_projects",
                _pause_before_tombstone,
            )
            await ExperimentSweeper(db=db)._delete_ephemeral_experiments()
        elif entry_point == "rest":
            monkeypatch.setattr(
                experiments_router,
                "tombstone_exclusive_experiment_projects",
                _pause_before_tombstone,
            )
            request = cast(
                Any,
                SimpleNamespace(
                    app=SimpleNamespace(state=SimpleNamespace(db=db)),
                    state=SimpleNamespace(
                        event_queue=event_queue, experiment_runner=experiment_runner
                    ),
                ),
            )
            await experiments_router.delete_experiment(
                request=request, experiment_id=str(experiment_global_id), delete_project=True
            )
        elif entry_point == "graphql":
            monkeypatch.setattr(
                experiment_mutations,
                "tombstone_exclusive_experiment_projects",
                _pause_before_tombstone,
            )
            info = cast(
                Any,
                SimpleNamespace(
                    context=SimpleNamespace(
                        db=db, event_queue=event_queue, experiment_runner=experiment_runner
                    )
                ),
            )
            await experiment_mutations.ExperimentMutationMixin().delete_experiments(
                info,
                DeleteExperimentsInput(experiment_ids=[experiment_global_id]),
            )
        else:
            assert_never(entry_point)

    async def _run_dataset_delete() -> None:
        await asyncio.wait_for(experiments_deleted.wait(), 5)
        delete_task = asyncio.create_task(
            lifecycle.execute_dataset_delete(db=db, dataset_id=dataset_id)
        )
        try:
            await _wait_until_lock_wait_or_done(db, delete_task, "FROM projects")
        finally:
            release_experiment_delete.set()
        await delete_task

    results = await asyncio.gather(
        _run_experiment_delete(), _run_dataset_delete(), return_exceptions=True
    )

    for result in results:
        if isinstance(result, DBAPIError):
            assert get_sqlstate(result) != "40P01", result
    assert all(result is None or isinstance(result, NotFound) for result in results), results
    async with db() as session:
        assert await session.get(models.Dataset, dataset_id) is None
        tombstoned_project = await session.get(models.Project, project_id)
        assert tombstoned_project is not None and tombstoned_project.deleted_at is not None
        assert await session.scalar(select(func.count(models.Experiment.id))) == 0


@pytest.mark.postgres_only
async def test_experiment_sweep_keeps_project_of_experiment_a_user_deleted_first(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from datetime import datetime, timedelta, timezone

    from phoenix.config import EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS
    from phoenix.server.daemons import experiment_sweeper
    from phoenix.server.daemons.experiment_sweeper import ExperimentSweeper

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        project = models.Project(name=f"kept-project-{token_hex(4)}")
        dataset = models.Dataset(name=f"kept-ds-{token_hex(4)}", metadata_={})
        session.add_all([project, dataset])
        await session.flush()
        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add(dataset_version)
        await session.flush()
        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
            project_name=project.name,
            is_ephemeral=True,
            updated_at=datetime.now(timezone.utc)
            - timedelta(hours=EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS + 1),
        )
        session.add(experiment)
        await session.flush()
        project_id = project.id
        experiment_id = experiment.id

    original_resolve = lifecycle.resolve_experiment_project_delete_candidates
    has_deleted_experiment = False

    async def _resolve_then_let_user_delete(*args: Any, **kwargs: Any) -> list[int]:
        nonlocal has_deleted_experiment
        project_ids = await original_resolve(*args, **kwargs)
        if not has_deleted_experiment:
            has_deleted_experiment = True
            async with db() as user_session:
                await user_session.execute(
                    delete(models.Experiment).where(models.Experiment.id == experiment_id)
                )
        return project_ids

    monkeypatch.setattr(
        experiment_sweeper,
        "resolve_experiment_project_delete_candidates",
        _resolve_then_let_user_delete,
    )
    await ExperimentSweeper(db=db)._delete_ephemeral_experiments()

    async with db() as session:
        kept_project = await session.get(models.Project, project_id)
        assert kept_project is not None and kept_project.deleted_at is None


@pytest.mark.postgres_only
async def test_persist_eval_results_reports_skipped_traces_of_a_tombstoned_binding_project(
    postgresql_engine: AsyncEngine,
) -> None:
    from datetime import datetime, timezone

    from phoenix.server.daemons.experiment_runner import EvalWorkItem

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    now_time = datetime.now(timezone.utc)
    async with db() as session:
        dataset = models.Dataset(name=f"exp-dl5-{token_hex(4)}", metadata_={})
        session.add(dataset)
        await session.flush()
        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        dataset_example = models.DatasetExample(dataset_id=dataset.id)
        session.add_all([dataset_version, dataset_example])
        await session.flush()
        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
        )
        session.add(experiment)
        await session.flush()
        experiment_run = models.ExperimentRun(
            experiment_id=experiment.id,
            dataset_example_id=dataset_example.id,
            repetition_number=1,
            output={"output": "hello"},
            start_time=now_time,
            end_time=now_time,
        )
        session.add(experiment_run)
        await session.flush()
        dataset_id = dataset.id

    dataset_binding = await dataset_bindings.create_dataset_llm_evaluator(
        context,
        dataset_bindings.CreateDatasetLLMEvaluatorInput(
            dataset_id=GlobalID("Dataset", str(dataset_id)),
            name=Identifier(f"ds-eval-{token_hex(4)}"),
            prompt_source=NewPrompt(_prompt_version()),
            output_configs=_output_configs(1.0),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={"output": "$.output"}),
        ),
    )
    async with db() as session:
        await session.execute(
            update(models.Project)
            .where(models.Project.id == dataset_binding.project_id)
            .values(deleted_at=now_time)
        )

    work_item = object.__new__(EvalWorkItem)
    work_item._db = db
    work_item._dataset_evaluator_id = dataset_binding.id
    work_item._experiment_run = experiment_run
    eval_trace = models.Trace(
        project_rowid=dataset_binding.project_id,
        trace_id=token_hex(16),
        start_time=now_time,
        end_time=now_time,
    )

    assert await work_item._persist_eval_results(annotations=[], db_traces=[eval_trace]) is False
    assert eval_trace.id is None


@pytest.mark.postgres_only
async def test_tombstone_project_conflicts_when_a_late_trace_project_is_locked_by_another_session(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.server.api.exceptions import Conflict
    from tests.unit._helpers import _bind_evaluator_trace_project

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        trace_project = models.Project(name=f"late-trace-{token_hex(4)}")
        session.add(trace_project)
        await session.flush()
        owner_project = models.Project(name=f"late-owner-{token_hex(4)}")
        session.add(owner_project)
        await session.flush()
        trace_project_id = trace_project.id
        owner_project_id = owner_project.id
    assert trace_project_id < owner_project_id

    original_read = lifecycle._read_live_bindings_owned_by
    has_bound_late_trace_project = False

    async def _read_then_bind_late_trace_project(*args: Any, **kwargs: Any) -> Any:
        nonlocal has_bound_late_trace_project
        rows = await original_read(*args, **kwargs)
        if not has_bound_late_trace_project:
            has_bound_late_trace_project = True
            async with db() as binding_session:
                late_trace_project = await binding_session.get(models.Project, trace_project_id)
                host_project = await binding_session.get(models.Project, owner_project_id)
                assert late_trace_project is not None and host_project is not None
                await _bind_evaluator_trace_project(
                    binding_session, late_trace_project, host_project=host_project
                )
        return rows

    monkeypatch.setattr(
        lifecycle, "_read_live_bindings_owned_by", _read_then_bind_late_trace_project
    )

    async def _tombstone_owner() -> None:
        async with db() as tombstone_session:
            await lifecycle.tombstone_project(tombstone_session, project_id=owner_project_id)

    async with db() as holder_session:
        await holder_session.execute(
            select(models.Project.id)
            .where(models.Project.id == trace_project_id)
            .with_for_update(key_share=True)
        )
        with pytest.raises(Conflict, match="modified concurrently"):
            await asyncio.wait_for(_tombstone_owner(), 5)

    async with db() as session:
        surviving_owner = await session.get(models.Project, owner_project_id)
        assert surviving_owner is not None and surviving_owner.deleted_at is None


async def _seed_expired_experiment(
    session: AsyncSession, *, dataset: models.Dataset, project: Optional[models.Project]
) -> None:
    from datetime import datetime, timedelta, timezone

    from phoenix.config import EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS

    dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
    session.add(dataset_version)
    await session.flush()
    session.add(
        models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
            project_name=project.name if project is not None else None,
            is_ephemeral=True,
            updated_at=datetime.now(timezone.utc)
            - timedelta(hours=EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS + 1),
        )
    )
    await session.flush()


@pytest.mark.postgres_only
async def test_experiment_sweep_locks_bound_evaluators_before_deleting_experiments(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.db.helpers import get_sqlstate
    from phoenix.server.daemons import experiment_sweeper
    from phoenix.server.daemons.experiment_sweeper import ExperimentSweeper
    from phoenix.server.evaluators.services import definitions as definitions_module

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = _service_context(db)
    async with db() as session:
        prompt = models.Prompt(
            name=Identifier(f"prompt-dl6-{token_hex(4)}"),
            prompt_versions=[_prompt_version()],
        )
        first_project = models.Project(name=f"first-exp-project-{token_hex(4)}")
        sink_project = models.Project(name=f"sink-project-{token_hex(4)}")
        first_dataset = models.Dataset(name=f"first-ds-{token_hex(4)}", metadata_={})
        second_dataset = models.Dataset(name=f"second-ds-{token_hex(4)}", metadata_={})
        session.add_all([prompt, first_project, sink_project, first_dataset, second_dataset])
        await session.flush()
        prompt_version_id = prompt.prompt_versions[0].id
        first_project_id = first_project.id
        sink_project_id = sink_project.id
        second_dataset_id = second_dataset.id
    evaluator = await definitions_module.create_llm_evaluator(
        context,
        definitions_module.CreateLLMEvaluatorInput(
            name=Identifier(f"eval-{token_hex(4)}"),
            prompt_version_id=GlobalID("PromptVersion", str(prompt_version_id)),
            output_configs=_output_configs(1.0),
        ),
    )
    await project_bindings.add_project_evaluator(
        context,
        GlobalID("LLMEvaluator", str(evaluator.id)),
        project_bindings.ProjectBindingSettings(
            project_id=GlobalID("Project", str(first_project_id)),
            name=Identifier(f"bind-{token_hex(4)}"),
            sampling_rate=1.0,
            evaluation_target="TRACE",
            input_mapping=InputMapping(literal_mapping={}, path_mapping={"output": "$.output"}),
        ),
    )
    async with db() as session:
        session.add(
            models.DatasetEvaluators(
                dataset_id=second_dataset_id,
                evaluator_id=evaluator.id,
                name=Identifier(root=f"ds-binding-{token_hex(4)}"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[],
                project_id=sink_project_id,
            )
        )
        first_project_row = await session.get(models.Project, first_project_id)
        first_dataset_row = await session.get(models.Dataset, first_dataset.id)
        second_dataset_row = await session.get(models.Dataset, second_dataset_id)
        assert first_project_row and first_dataset_row and second_dataset_row
        await _seed_expired_experiment(
            session, dataset=first_dataset_row, project=first_project_row
        )
        await _seed_expired_experiment(session, dataset=second_dataset_row, project=None)

    experiments_deleted = asyncio.Event()
    release_sweeper = asyncio.Event()
    original_tombstone = lifecycle.tombstone_exclusive_experiment_projects

    async def _pause_before_tombstone(*args: Any, **kwargs: Any) -> list[int]:
        experiments_deleted.set()
        await asyncio.wait_for(release_sweeper.wait(), 5)
        return await original_tombstone(*args, **kwargs)

    monkeypatch.setattr(
        experiment_sweeper, "tombstone_exclusive_experiment_projects", _pause_before_tombstone
    )

    async def _run_dataset_delete() -> None:
        await asyncio.wait_for(experiments_deleted.wait(), 5)
        delete_task = asyncio.create_task(
            lifecycle.execute_dataset_delete(db=db, dataset_id=second_dataset_id)
        )
        try:
            await _wait_until_lock_wait_or_done(db, delete_task, "FROM evaluators")
        finally:
            release_sweeper.set()
        await delete_task

    results = await asyncio.gather(
        ExperimentSweeper(db=db)._delete_ephemeral_experiments(),
        _run_dataset_delete(),
        return_exceptions=True,
    )

    for result in results:
        if isinstance(result, DBAPIError):
            assert get_sqlstate(result) != "40P01", result
    assert all(result is None or isinstance(result, NotFound) for result in results), results
    async with db() as session:
        assert await session.get(models.Dataset, second_dataset_id) is None
        assert await session.scalar(select(func.count(models.Experiment.id))) == 0


@pytest.mark.postgres_only
async def test_experiment_sweep_locks_lower_id_trace_project_before_experiment_projects(
    postgresql_engine: AsyncEngine,
) -> None:
    from phoenix.db.helpers import get_sqlstate
    from phoenix.server.daemons.experiment_sweeper import ExperimentSweeper
    from tests.unit._helpers import _bind_evaluator_trace_project

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        trace_project = models.Project(name=f"low-trace-project-{token_hex(4)}")
        session.add(trace_project)
        await session.flush()
        first_project = models.Project(name=f"first-exp-project-{token_hex(4)}")
        second_project = models.Project(name=f"second-exp-project-{token_hex(4)}")
        dataset = models.Dataset(name=f"ds-{token_hex(4)}", metadata_={})
        session.add_all([first_project, second_project, dataset])
        await session.flush()
        await _bind_evaluator_trace_project(session, trace_project, host_project=first_project)
        await _seed_expired_experiment(session, dataset=dataset, project=first_project)
        await _seed_expired_experiment(session, dataset=dataset, project=second_project)
        trace_project_id = trace_project.id
        second_project_id = second_project.id
    assert trace_project_id < second_project_id

    sweep_task = None
    async with db() as holder_session:
        await holder_session.execute(
            select(models.Project.id)
            .where(models.Project.id == trace_project_id)
            .with_for_update(key_share=True)
        )
        sweep_task = asyncio.create_task(ExperimentSweeper(db=db)._delete_ephemeral_experiments())
        await _wait_until_lock_wait_or_done(db, sweep_task, "FROM projects")
        try:
            await asyncio.wait_for(
                holder_session.execute(
                    select(models.Project.id)
                    .where(models.Project.id == second_project_id)
                    .with_for_update(key_share=True)
                ),
                5,
            )
        except DBAPIError as error:
            assert get_sqlstate(error) != "40P01", error
            raise
    await asyncio.wait_for(sweep_task, 5)
    async with db() as session:
        assert await session.scalar(select(func.count(models.Experiment.id))) == 0
