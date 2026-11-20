import asyncio
from collections.abc import Coroutine
from secrets import token_hex
from typing import Any, cast

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine
from strawberry.relay import GlobalID

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
    TextContentPart,
)
from phoenix.server.api.exceptions import NotFound
from phoenix.server.app import _db
from phoenix.server.evaluators.services import dataset_bindings, project_bindings
from phoenix.server.evaluators.services.definitions import EvaluatorServiceContext
from phoenix.server.evaluators.services.prompt_source import FromPromptVersion, NewPrompt
from phoenix.server.evaluators.services.purge import purge_deleted_bindings
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
        row = await session.get(binding_model, binding.id)
        assert row is not None and row.deleted_at is not None
    await purge_deleted_bindings(db)
    async with db() as session:
        assert await session.get(binding_model, binding.id) is None
