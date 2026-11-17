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
    while await coordinator.run_one_step():
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
