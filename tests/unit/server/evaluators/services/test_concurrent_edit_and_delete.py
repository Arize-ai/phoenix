import asyncio
from collections.abc import Coroutine
from secrets import token_hex
from typing import Any, cast

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from strawberry import UNSET
from strawberry.relay import GlobalID

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
from phoenix.server.cleanup.coordinator import CleanupCoordinator
from phoenix.server.evaluators.services import dataset_bindings, decisions, project_bindings
from phoenix.server.evaluators.services.definitions import EvaluatorServiceContext
from phoenix.server.evaluators.services.prompt_source import FromPromptVersion, NewPrompt
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import DbSessionFactory


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
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
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
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
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
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
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


async def test_patch_decision_evaluator_raises_not_found_when_decision_collected_before_flush(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
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
    async with db() as session:
        await session.execute(
            delete(models.DecisionVersionTag).where(
                models.DecisionVersionTag.id == evaluator.decision_version_tag_id
            )
        )

    apply_version_and_policy = decisions._apply_decision_version_and_policy

    async def apply_then_collect_evaluator_and_decision(
        session: AsyncSession,
        target_evaluator: models.DecisionEvaluator,
        version: models.DecisionVersion | None,
        scoring_policy: Any,
        *,
        user_id: int | None,
    ) -> models.DecisionVersion:
        selected = await apply_version_and_policy(
            session, target_evaluator, version, scoring_policy, user_id=user_id
        )
        with session.no_autoflush:
            await session.execute(
                delete(models.Evaluator).where(models.Evaluator.id == target_evaluator.id),
                execution_options={"synchronize_session": False},
            )
            await session.execute(
                delete(models.Decision).where(models.Decision.id == target_evaluator.decision_id),
                execution_options={"synchronize_session": False},
            )
        return selected

    monkeypatch.setattr(
        decisions, "_apply_decision_version_and_policy", apply_then_collect_evaluator_and_decision
    )

    with pytest.raises(NotFound, match="Decision version not found"):
        await decisions.patch_decision_evaluator(
            context,
            evaluator_global_id,
            decisions.DecisionEvaluatorPatch(decision_version_id=next_version_global_id),
        )


@pytest.mark.parametrize("rename_mode", ["unset", "own_name", "new_name"])
async def test_patch_decision_evaluator_raises_not_found_when_version_deleted_before_flush(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    rename_mode: str,
) -> None:
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
    async with db() as session:
        decision = models.Decision(name=Identifier(f"decision-{token_hex(4)}"), metadata_={})
        initial_version = _create_decision_version(decision=decision)
        next_version = _create_decision_version(decision=decision)
        session.add_all([initial_version, next_version])
        await session.flush()
        initial_version_global_id = GlobalID("DecisionVersion", str(initial_version.id))
        next_version_global_id = GlobalID("DecisionVersion", str(next_version.id))

    evaluator_name = Identifier(f"judge-{token_hex(4)}")
    evaluator = await decisions.create_decision_evaluator(
        context,
        decisions.CreateDecisionEvaluatorInput(
            name=evaluator_name,
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

    patch_name: Identifier | None
    if rename_mode == "unset":
        patch_name = UNSET
    elif rename_mode == "own_name":
        patch_name = evaluator_name
    else:
        patch_name = Identifier(f"renamed-{token_hex(4)}")

    with pytest.raises(NotFound, match="Decision version not found"):
        await decisions.patch_decision_evaluator(
            context,
            evaluator_global_id,
            decisions.DecisionEvaluatorPatch(
                name=patch_name,
                decision_version_id=next_version_global_id,
            ),
        )


@pytest.mark.postgres_only
@pytest.mark.parametrize("target", ["project", "dataset"])
async def test_logical_delete_evaluators_ignores_binding_committed_after_discovery(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
    target: str,
) -> None:
    from phoenix.server.cleanup import lifecycle

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
    mapping = InputMapping(literal_mapping={}, path_mapping={"output": "$.output"})

    commit_second_binding = asyncio.Event()
    second_binding_flushed = asyncio.Event()
    second_binding_committed = asyncio.Event()
    second_binding_ids: list[int] = []

    if target == "project":
        async with db() as session:
            owner_project = models.Project(name=f"disc-race-proj-{token_hex(4)}")
            session.add(owner_project)
            await session.flush()
            owner_project_id = owner_project.id
        first_project_binding = await project_bindings.create_project_llm_evaluator(
            context,
            project_bindings.CreateProjectLLMEvaluatorInput(
                project_id=GlobalID("Project", str(owner_project_id)),
                name=Identifier(f"first-{token_hex(4)}"),
                prompt_source=NewPrompt(_prompt_version()),
                output_configs=_output_configs(1.0),
                input_mapping=mapping,
                sampling_rate=1.0,
                evaluation_target="TRACE",
            ),
        )
        first_binding_id = first_project_binding.id

        async def _stage_second_project_binding() -> None:
            async with db() as staging_session:
                trace_project = models.Project(
                    name=f"disc-race-trace-{token_hex(4)}",
                )
                staging_session.add(trace_project)
                await staging_session.flush()
                staged_binding = models.ProjectEvaluator(
                    project_id=owner_project_id,
                    evaluator_id=first_project_binding.evaluator_id,
                    trace_project_id=trace_project.id,
                    name=Identifier(f"second-{token_hex(4)}"),
                    evaluation_target="TRACE",
                    filter_condition="",
                    sampling_rate=1.0,
                )
                staging_session.add(staged_binding)
                await staging_session.flush()
                second_binding_ids.append(staged_binding.id)
                second_binding_flushed.set()
                await commit_second_binding.wait()
            second_binding_committed.set()

        stager_task = asyncio.create_task(_stage_second_project_binding())
    else:
        async with db() as session:
            owner_dataset = models.Dataset(name=f"disc-race-ds-{token_hex(4)}", metadata_={})
            session.add(owner_dataset)
            await session.flush()
            owner_dataset_id = owner_dataset.id
        first_dataset_binding = await dataset_bindings.create_dataset_llm_evaluator(
            context,
            dataset_bindings.CreateDatasetLLMEvaluatorInput(
                dataset_id=GlobalID("Dataset", str(owner_dataset_id)),
                name=Identifier(f"first-{token_hex(4)}"),
                prompt_source=NewPrompt(_prompt_version()),
                output_configs=_output_configs(1.0),
                input_mapping=mapping,
            ),
        )
        first_binding_id = first_dataset_binding.id

        async def _stage_second_dataset_binding() -> None:
            async with db() as staging_session:
                trace_project = models.Project(
                    name=f"disc-race-trace-{token_hex(4)}",
                )
                staging_session.add(trace_project)
                await staging_session.flush()
                staged_binding = models.DatasetEvaluators(
                    dataset_id=owner_dataset_id,
                    evaluator_id=first_dataset_binding.evaluator_id,
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

        stager_task = asyncio.create_task(_stage_second_dataset_binding())

    await asyncio.wait_for(second_binding_flushed.wait(), 5)
    second_binding_id = second_binding_ids[0]

    original_lock_projects = lifecycle._lock_projects

    async def _lock_projects_after_second_commits(*args: Any, **kwargs: Any) -> None:
        commit_second_binding.set()
        await asyncio.wait_for(second_binding_committed.wait(), 5)
        await original_lock_projects(*args, **kwargs)

    monkeypatch.setattr(lifecycle, "_lock_projects", _lock_projects_after_second_commits)

    async with db() as delete_session:
        if target == "project":
            await lifecycle.logical_delete_project_evaluators(
                delete_session,
                binding_ids=[first_binding_id, second_binding_id],
                collect_unused_evaluator=False,
                delete_associated_prompt=False,
            )
        else:
            await lifecycle.logical_delete_dataset_evaluators(
                delete_session,
                binding_ids=[first_binding_id, second_binding_id],
                collect_unused_evaluator=False,
                delete_associated_prompt=False,
            )
    await asyncio.wait_for(stager_task, 5)

    async with db() as verify_session:
        model_cls: Any = (
            models.ProjectEvaluator if target == "project" else models.DatasetEvaluators
        )
        first_after = await verify_session.get(model_cls, first_binding_id)
        second_after = await verify_session.get(model_cls, second_binding_id)
        assert first_after is not None and first_after.deleted_at is not None
        assert second_after is not None and second_after.deleted_at is None


@pytest.mark.postgres_only
async def test_concurrent_admit_project_delete_and_persist_evaluator_traces(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.server.cleanup import lifecycle
    from phoenix.server.online_eval.tracing import persist_evaluator_traces
    from phoenix.tracers import Tracer

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
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

    async def _run_admit_delete() -> None:
        await asyncio.wait_for(trace_locked_binding.wait(), 5)
        async with db() as delete_session:
            await lifecycle.admit_project_delete(
                delete_session,
                project_id=owner_project_id,
            )

    await asyncio.gather(
        persist_evaluator_traces(
            db=db,
            tracer=tracer,
            project_evaluator_id=binding.id,
        ),
        _run_admit_delete(),
    )


@pytest.mark.postgres_only
async def test_admit_exclusive_experiment_projects_delete_locks_evaluators_in_id_order(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.server.cleanup import lifecycle
    from phoenix.server.evaluators.services import definitions as definitions_module
    from phoenix.server.evaluators.services.management import (
        lock_evaluators as original_lock_evaluators,
    )

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
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

    locked_evaluator_batches: list[list[int]] = []

    async def _record_lock_evaluators(lock_session: AsyncSession, evaluator_ids: Any) -> None:
        batch = sorted(set(evaluator_ids))
        if batch:
            locked_evaluator_batches.append(batch)
        await original_lock_evaluators(lock_session, evaluator_ids)

    monkeypatch.setattr(lifecycle, "lock_evaluators", _record_lock_evaluators)

    async with db() as delete_session:
        candidate_project_ids = await lifecycle.resolve_experiment_project_delete_candidates(
            delete_session, candidate_project_names=exp_project_names
        )
        tombstoned_ids = await lifecycle.admit_exclusive_experiment_projects_delete(
            delete_session,
            candidate_project_ids=candidate_project_ids,
        )

    assert locked_evaluator_batches == [[lower_evaluator.id, higher_evaluator.id]]
    assert len(tombstoned_ids) == 4


async def _wait_until_lock_wait_or_done(
    db: DbSessionFactory,
    task: "asyncio.Task[Any]",
    query_fragment: str,
) -> None:
    """Return as soon as ``task`` completes or PostgreSQL parks its query on a row lock."""
    from sqlalchemy import text

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
            raise TimeoutError(f"Timed out waiting for lock wait on {query_fragment!r}")
        await asyncio.sleep(0.01)


@pytest.mark.postgres_only
async def test_experiment_runner_persist_traces_does_not_deadlock_with_dataset_evaluator_delete(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from datetime import datetime, timezone

    from phoenix.server.cleanup import lifecycle
    from phoenix.server.daemons.experiment_runner import EvalWorkItem
    from phoenix.server.evaluators.services.management import (
        lock_evaluators as original_lock_evaluators,
    )

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
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
            await lifecycle.logical_delete_dataset_evaluators(
                delete_session,
                binding_ids=[dataset_binding.id],
                collect_unused_evaluator=False,
                delete_associated_prompt=False,
            )

    async def _run_persist() -> None:
        await asyncio.wait_for(project_locked_by_delete.wait(), 5)
        persist_task = asyncio.create_task(
            work_item._persist_eval_results(annotations=[], db_traces=[eval_trace])
        )
        try:
            await _wait_until_lock_wait_or_done(
                db, persist_task, "FROM dataset_evaluators JOIN projects"
            )
        finally:
            release_delete_binding_lock.set()
        await persist_task

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
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
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
async def test_delete_prompt_locks_prompt_before_checking_evaluators(
    postgresql_engine: AsyncEngine,
) -> None:
    from types import SimpleNamespace

    from phoenix.server.api.mutations.prompt_mutations import (
        DeletePromptInput,
        PromptMutationMixin,
    )

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        prompt = models.Prompt(
            name=Identifier(f"prompt-lock-{token_hex(4)}"),
            prompt_versions=[_prompt_version()],
        )
        session.add(prompt)
        await session.flush()
        prompt_id = prompt.id

    info = SimpleNamespace(context=SimpleNamespace(db=db))
    mixin = PromptMutationMixin()

    async with db() as key_share_session:
        await key_share_session.execute(
            select(models.Prompt.id)
            .where(models.Prompt.id == prompt_id)
            .with_for_update(read=True, key_share=True)
        )
        delete_task = asyncio.create_task(
            mixin.delete_prompt(
                cast(Any, info),
                DeletePromptInput(prompt_id=GlobalID("Prompt", str(prompt_id))),
            )
        )
        await _wait_until_lock_wait_or_done(db, delete_task, "SELECT prompts.id \nFROM prompts")
        assert not delete_task.done()
    await asyncio.wait_for(delete_task, 5)


@pytest.mark.postgres_only
async def test_delete_project_evaluator_skips_surviving_prompt_lock(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = EvaluatorServiceContext(
        db=db,
        sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None)),
    )
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
        await asyncio.wait_for(
            project_bindings.delete_project_evaluators(
                context,
                project_bindings.DeleteProjectEvaluatorsInput(
                    project_evaluator_ids=[
                        GlobalID("ProjectEvaluator", str(sole_binding.id)),
                        GlobalID("ProjectEvaluator", str(first_shared_binding.id)),
                    ],
                    delete_associated_prompt=True,
                ),
            ),
            timeout=1.5,
        )


@pytest.mark.postgres_only
async def test_delete_project_evaluator_emits_tombstone_events(
    postgresql_engine: AsyncEngine,
) -> None:
    from phoenix.server.dml_event import DmlEvent, ProjectDeleteEvent, SpanDeleteEvent

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    recorded_events: list[DmlEvent] = []

    class _RecordingQueue:
        def put(self, item: DmlEvent) -> None:
            recorded_events.append(item)

    context = EvaluatorServiceContext(
        db=db,
        sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None)),
        event_queue=_RecordingQueue(),
    )
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
    assert SpanDeleteEvent((binding.trace_project_id,)) in recorded_events
    assert ProjectDeleteEvent((binding.trace_project_id,)) in recorded_events


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
        synced_builtins = (await session.scalars(select(models.BuiltinEvaluator.key))).all()
        assert len(synced_builtins) > 0


@pytest.mark.postgres_only
async def test_delete_dataset_locks_experiment_projects_before_evaluators_and_emits_events(
    postgresql_engine: AsyncEngine,
) -> None:
    from types import SimpleNamespace

    from phoenix.server.api.input_types.DeleteDatasetInput import DeleteDatasetInput
    from phoenix.server.api.mutations.dataset_mutations import DatasetMutationMixin
    from phoenix.server.dml_event import DmlEvent, ProjectDeleteEvent, SpanDeleteEvent

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    recorded_events: list[DmlEvent] = []

    class _RecordingQueue:
        def put(self, item: DmlEvent) -> None:
            recorded_events.append(item)

    event_queue = _RecordingQueue()
    context = EvaluatorServiceContext(
        db=db,
        sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None)),
        event_queue=event_queue,
    )
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
    assert SpanDeleteEvent(expected_project_ids) in recorded_events
    assert ProjectDeleteEvent(expected_project_ids) in recorded_events


@pytest.mark.postgres_only
async def test_delete_project_handles_lower_slipped_trace_project_and_emits_child_events(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from types import SimpleNamespace

    from phoenix.server.api.mutations.project_mutations import ProjectMutationMixin
    from phoenix.server.cleanup import lifecycle
    from phoenix.server.dml_event import DmlEvent, ProjectDeleteEvent, SpanDeleteEvent

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    recorded_events: list[DmlEvent] = []

    class _RecordingQueue:
        def put(self, item: DmlEvent) -> None:
            recorded_events.append(item)

    event_queue = _RecordingQueue()
    context = EvaluatorServiceContext(
        db=db,
        sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None)),
        event_queue=event_queue,
    )
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
    assert SpanDeleteEvent(expected_project_ids) in recorded_events
    assert ProjectDeleteEvent(expected_project_ids) in recorded_events


@pytest.mark.postgres_only
async def test_patch_decision_evaluator_does_not_lock_decision_versions_and_delete_locks_first(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from types import SimpleNamespace

    from phoenix.server.api.mutations.saved_decision_mutations import (
        DeleteDecisionInput,
        SavedDecisionMutationMixin,
    )

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
    async with db() as session:
        decision = models.Decision(name=Identifier(f"dec-dl4-{token_hex(4)}"), metadata_={})
        initial_version = _create_decision_version(decision=decision)
        next_version = _create_decision_version(decision=decision)
        free_decision = models.Decision(name=Identifier(f"dec-free-{token_hex(4)}"), metadata_={})
        free_version = _create_decision_version(decision=free_decision)
        session.add_all([initial_version, next_version, free_version])
        await session.flush()
        initial_version_id = initial_version.id
        next_version_id = next_version.id
        free_decision_id = free_decision.id

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

    info = SimpleNamespace(context=SimpleNamespace(db=db))
    mixin = SavedDecisionMutationMixin()
    async with db() as key_share_session:
        await key_share_session.execute(
            select(models.Decision.id)
            .where(models.Decision.id == free_decision_id)
            .with_for_update(read=True, key_share=True)
        )
        delete_task = asyncio.create_task(
            mixin.delete_decision(
                cast(Any, info),
                DeleteDecisionInput(decision_id=GlobalID("Decision", str(free_decision_id))),
            )
        )
        await _wait_until_lock_wait_or_done(db, delete_task, "SELECT decisions.id \nFROM decisions")
        assert not delete_task.done()
    await asyncio.wait_for(delete_task, 5)
