"""An LLM evaluator's prompt version tag: what deleting it, or the evaluator, leaves behind."""

from copy import deepcopy
from secrets import token_hex
from typing import Any, AsyncIterator, Sequence, cast
from urllib.parse import quote_plus

import httpx
import pytest
import sqlalchemy as sa
from sqlalchemy import select
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
    PromptToolChoiceOneOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
    TextContentPart,
)
from phoenix.server.evaluators.services.dataset_bindings import (
    DeleteDatasetEvaluatorsInput,
    delete_dataset_evaluators,
)
from phoenix.server.evaluators.services.definitions import (
    EvaluatorServiceContext,
    delete_llm_evaluator,
)
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_EVALUATOR_LABELS = ("correct", "incorrect")


def _prompt_version(
    text: str,
    labels: Sequence[str] = _EVALUATOR_LABELS,
) -> models.PromptVersion:
    return models.PromptVersion(
        template_type=PromptTemplateType.CHAT,
        template_format=PromptTemplateFormat.MUSTACHE,
        template=PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(role="user", content=[TextContentPart(type="text", text=text)])
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
                        name="correctness",
                        description="correctness",
                        parameters={
                            "type": "object",
                            "properties": {
                                "label": {
                                    "type": "string",
                                    "enum": list(labels),
                                    "description": "correctness",
                                }
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
        model_name="gpt-4o-mini",
        metadata_={},
    )


def _output_config(labels: Sequence[str]) -> CategoricalOutputConfig:
    return CategoricalOutputConfig(
        type="CATEGORICAL",
        name="correctness",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        values=[
            CategoricalAnnotationValue(label=label, score=float(i == 0))
            for i, label in enumerate(labels)
        ],
    )


class _Fixture:
    def __init__(self, evaluator: models.LLMEvaluator, prompt: models.Prompt) -> None:
        self.evaluator = evaluator
        self.prompt = prompt
        self.pinned_version, self.newest_version = prompt.prompt_versions
        tag = evaluator.prompt_version_tag
        assert tag is not None
        self.tag = tag


@pytest.fixture
async def pinned(db: DbSessionFactory) -> AsyncIterator[_Fixture]:
    """An evaluator whose tag pins the older of two versions; the newer uses other labels."""
    prompt = models.Prompt(
        name=Identifier.model_validate(f"tag-move-prompt-{token_hex(4)}"),
        description="tag move",
        prompt_versions=[
            _prompt_version("Judge {{output}}"),
            _prompt_version("Rate {{output}}", labels=("good", "bad")),
        ],
    )
    evaluator = models.LLMEvaluator(
        name=Identifier.model_validate(f"tag-move-evaluator-{token_hex(4)}"),
        description="correctness",
        kind="LLM",
        output_configs=[_output_config(_EVALUATOR_LABELS)],
        prompt=prompt,
    )
    async with db() as session:
        session.add(evaluator)
        await session.flush()
        evaluator.prompt_version_tag = models.PromptVersionTag(
            name=Identifier.model_validate(f"{evaluator.name.root}-evaluator-{token_hex(4)}"),
            prompt_id=prompt.id,
            prompt_version_id=prompt.prompt_versions[0].id,
        )
        session.add(evaluator)
        await session.flush()
        await session.refresh(evaluator, attribute_names=["updated_at"])
    yield _Fixture(evaluator, prompt)
    async with db() as session:
        await session.execute(
            sa.delete(models.LLMEvaluator).where(models.LLMEvaluator.id == evaluator.id)
        )
        await session.execute(sa.delete(models.Prompt).where(models.Prompt.id == prompt.id))


async def test_deleting_the_tag_leaves_the_evaluator_on_the_newest_version(
    httpx_client: httpx.AsyncClient, db: DbSessionFactory, pinned: _Fixture
) -> None:
    version_path = quote_plus(str(GlobalID("PromptVersion", str(pinned.pinned_version.id))))
    response = await httpx_client.delete(
        f"v1/prompt_versions/{version_path}/tags/{quote_plus(pinned.tag.name.root)}"
    )
    assert response.status_code == 204, response.text

    async with db() as session:
        evaluator = await session.get(models.LLMEvaluator, pinned.evaluator.id)
        assert evaluator is not None and evaluator.prompt_version_tag_id is None
    evaluator_gid = quote_plus(str(GlobalID("LLMEvaluator", str(pinned.evaluator.id))))
    response = await httpx_client.get(f"v1/evaluators/{evaluator_gid}")
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt"]["selector"] == {"type": "latest"}
    assert response.json()["data"]["prompt"]["resolved_prompt_version_id"] == str(
        GlobalID("PromptVersion", str(pinned.newest_version.id))
    )


async def _add_evaluator_sharing_tag(db: DbSessionFactory, pinned: _Fixture) -> int:
    async with db() as session:
        evaluator = models.LLMEvaluator(
            name=Identifier.model_validate(f"shared-tag-evaluator-{token_hex(4)}"),
            description=pinned.evaluator.description,
            kind="LLM",
            output_configs=pinned.evaluator.output_configs,
            prompt_id=pinned.evaluator.prompt_id,
            prompt_version_tag_id=pinned.tag.id,
        )
        session.add(evaluator)
        await session.flush()
        return evaluator.id


def _evaluator_service_context(db: DbSessionFactory) -> EvaluatorServiceContext:
    return EvaluatorServiceContext(
        db=db,
        sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None)),
    )


async def test_deleting_definition_preserves_a_tag_used_by_another_evaluator(
    db: DbSessionFactory, pinned: _Fixture
) -> None:
    sibling_id = await _add_evaluator_sharing_tag(db, pinned)
    context = _evaluator_service_context(db)
    await delete_llm_evaluator(context, GlobalID("LLMEvaluator", str(pinned.evaluator.id)))

    async with db() as session:
        assert await session.get(models.LLMEvaluator, pinned.evaluator.id) is None
        assert await session.get(models.LLMEvaluator, sibling_id) is not None
        assert await session.get(models.PromptVersionTag, pinned.tag.id) is not None

    await delete_llm_evaluator(context, GlobalID("LLMEvaluator", str(sibling_id)))


async def test_last_binding_gc_preserves_a_tag_used_by_another_evaluator(
    db: DbSessionFactory, pinned: _Fixture
) -> None:
    sibling_id = await _add_evaluator_sharing_tag(db, pinned)
    async with db() as session:
        dataset = models.Dataset(name=f"shared-tag-{token_hex(4)}", metadata_={})
        binding = models.DatasetEvaluators(
            dataset=dataset,
            evaluator_id=pinned.evaluator.id,
            name=Identifier.model_validate(f"shared-tag-binding-{token_hex(4)}"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            project=models.Project(name=f"shared-tag-trace-{token_hex(4)}"),
        )
        session.add(binding)
        await session.flush()
        binding_id = binding.id

    await delete_dataset_evaluators(
        _evaluator_service_context(db),
        DeleteDatasetEvaluatorsInput(
            dataset_evaluator_ids=[GlobalID("DatasetEvaluator", str(binding_id))],
            delete_associated_prompt=False,
        ),
    )

    async with db() as session:
        assert await session.get(models.LLMEvaluator, pinned.evaluator.id) is None
        assert await session.get(models.LLMEvaluator, sibling_id) is not None
        assert await session.get(models.PromptVersionTag, pinned.tag.id) is not None

    await delete_llm_evaluator(
        _evaluator_service_context(db), GlobalID("LLMEvaluator", str(sibling_id))
    )


def _prompt_version_input() -> dict[str, Any]:
    return {
        "templateFormat": "MUSTACHE",
        "template": {
            "messages": [{"role": "USER", "content": [{"text": {"text": "Judge {{output}}"}}]}]
        },
        "invocationParameters": {"openai": {}},
        "tools": {
            "tools": [
                {
                    "function": {
                        "name": "correctness",
                        "description": "correctness",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "label": {
                                    "type": "string",
                                    "enum": list(_EVALUATOR_LABELS),
                                    "description": "correctness",
                                }
                            },
                            "required": ["label"],
                        },
                    }
                }
            ],
            "toolChoice": {"functionName": "correctness"},
        },
        "modelProvider": "OPENAI",
        "modelName": "gpt-4o-mini",
    }


_OUTPUT_CONFIGS_INPUT = [
    {
        "categorical": {
            "name": "correctness",
            "optimizationDirection": "MAXIMIZE",
            "values": [{"label": "correct", "score": 1}, {"label": "incorrect", "score": 0}],
        }
    }
]

_CREATE_PROJECT_LLM = """
    mutation($input: CreateProjectLLMEvaluatorInput!) {
      createProjectLlmEvaluator(input: $input) { evaluator { id evaluator { id } } }
    }
"""

_CREATE_DATASET_LLM = """
    mutation($input: CreateDatasetLLMEvaluatorInput!) {
      createDatasetLlmEvaluator(input: $input) {
        evaluator { id evaluator { ... on LLMEvaluator { id } } }
      }
    }
"""

_UPDATE_PROJECT_LLM = """
    mutation($input: UpdateProjectLLMEvaluatorInput!) {
      updateProjectLlmEvaluator(input: $input) { evaluator { id } }
    }
"""

_UPDATE_DATASET_LLM = """
    mutation($input: UpdateDatasetLLMEvaluatorInput!) {
      updateDatasetLlmEvaluator(input: $input) { evaluator { id } }
    }
"""


async def _undescribed_evaluator(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory, binding: str
) -> tuple[int, str, dict[str, Any]]:
    """Create an LLM evaluator without a description through a project or dataset binding.

    Returns the evaluator id and the binding's update mutation with an input that keeps the
    evaluator's prompt content as created.
    """
    name = f"undescribed-{token_hex(4)}"
    definition: dict[str, Any] = {
        "name": name,
        "description": None,
        "promptVersion": _prompt_version_input(),
        "outputConfigs": _OUTPUT_CONFIGS_INPUT,
        "inputMapping": {"literalMapping": {}, "pathMapping": {"output": "$.output"}},
    }
    if binding == "project":
        async with db() as session:
            project = models.Project(name=f"{name}-project")
            session.add(project)
        schedule = {"samplingRate": 1.0, "evaluationTarget": "TRACE"}
        project_id = str(GlobalID("Project", str(project.id)))
        result = await gql_client.execute(
            _CREATE_PROJECT_LLM, {"input": {**definition, **schedule, "projectId": project_id}}
        )
        assert result.data and not result.errors, result.errors
        created = result.data["createProjectLlmEvaluator"]["evaluator"]
        mutation = _UPDATE_PROJECT_LLM
        update_input = {
            **definition,
            **schedule,
            "projectEvaluatorId": created["id"],
            "filterCondition": "",
        }
    else:
        async with db() as session:
            dataset = models.Dataset(name=f"{name}-dataset", metadata_={})
            session.add(dataset)
        dataset_id = str(GlobalID("Dataset", str(dataset.id)))
        result = await gql_client.execute(
            _CREATE_DATASET_LLM, {"input": {**definition, "datasetId": dataset_id}}
        )
        assert result.data and not result.errors, result.errors
        created = result.data["createDatasetLlmEvaluator"]["evaluator"]
        mutation = _UPDATE_DATASET_LLM
        update_input = {**definition, "datasetEvaluatorId": created["id"], "datasetId": dataset_id}
    return int(GlobalID.from_id(created["evaluator"]["id"]).node_id), mutation, update_input


async def _add_compatible_dataset_override(
    db: DbSessionFactory,
    evaluator_id: int,
    *,
    description: str,
    labels: Sequence[str],
    dataset_name: str | None = None,
    binding_name: str | None = None,
) -> int:
    """Add a binding override that is valid against the evaluator's current prompt."""
    binding = models.DatasetEvaluators(
        dataset=models.Dataset(name=dataset_name or f"binding-edit-{token_hex(4)}", metadata_={}),
        evaluator_id=evaluator_id,
        name=Identifier.model_validate(binding_name or f"binding-edit-{token_hex(4)}"),
        description=description,
        output_configs=[_output_config(labels)],
        input_mapping=InputMapping(literal_mapping={}, path_mapping={"output": "$.output"}),
        project=models.Project(name=f"binding-edit-{token_hex(4)}"),
    )
    async with db() as session:
        session.add(binding)
        await session.flush()
        return binding.id


async def _add_project_binding(db: DbSessionFactory, evaluator_id: int) -> int:
    binding = models.ProjectEvaluator(
        project=models.Project(name=f"binding-edit-{token_hex(4)}"),
        evaluator_id=evaluator_id,
        trace_project=models.Project(name=f"binding-edit-trace-{token_hex(4)}"),
        name=Identifier.model_validate(f"binding-edit-{token_hex(4)}"),
        filter_condition="",
        sampling_rate=1.0,
        evaluation_target="TRACE",
        input_mapping=None,
        evaluation_delay_seconds=300,
        enabled=True,
    )
    async with db() as session:
        session.add(binding)
        await session.flush()
        return binding.id


def _change_llm_definition(update_input: dict[str, Any]) -> dict[str, Any]:
    """Rename the binding and edit the prompt's text, keeping its outputs."""
    candidate = deepcopy(update_input)
    candidate["name"] = f"edited-{candidate['name']}"
    candidate["promptVersion"]["template"]["messages"][0]["content"][0]["text"]["text"] = (
        "Updated judge {{output}}"
    )
    return candidate


async def _llm_edit_state(db: DbSessionFactory, evaluator_id: int) -> dict[str, Any]:
    """Capture shared definitions, binding overrides, and prompt/tag writes for rollback checks."""
    async with db() as session:
        evaluator = await session.get(models.LLMEvaluator, evaluator_id)
        assert evaluator is not None
        tag = await session.get(models.PromptVersionTag, evaluator.prompt_version_tag_id)
        dataset_bindings = (
            await session.scalars(
                select(models.DatasetEvaluators)
                .where(models.DatasetEvaluators.evaluator_id == evaluator_id)
                .order_by(models.DatasetEvaluators.id)
            )
        ).all()
        project_bindings = (
            await session.scalars(
                select(models.ProjectEvaluator)
                .where(models.ProjectEvaluator.evaluator_id == evaluator_id)
                .order_by(models.ProjectEvaluator.id)
            )
        ).all()
        return {
            "name": evaluator.name.root,
            "description": evaluator.description,
            "output_configs": [
                config.model_dump(mode="json") for config in evaluator.output_configs
            ],
            "prompt_id": evaluator.prompt_id,
            "tag_id": evaluator.prompt_version_tag_id,
            "tag_version_id": tag.prompt_version_id if tag else None,
            "updated_at": evaluator.updated_at,
            "user_id": evaluator.user_id,
            "prompt_count": await session.scalar(select(sa.func.count(models.Prompt.id))),
            "prompt_version_count": await session.scalar(
                select(sa.func.count(models.PromptVersion.id)).where(
                    models.PromptVersion.prompt_id == evaluator.prompt_id
                )
            ),
            "prompt_labels": (
                await session.execute(
                    select(models.PromptPromptLabel.prompt_id, models.PromptLabel.name)
                    .join(
                        models.PromptLabel,
                        models.PromptPromptLabel.prompt_label_id == models.PromptLabel.id,
                    )
                    .order_by(models.PromptPromptLabel.prompt_id, models.PromptLabel.name)
                )
            ).all(),
            "dataset_bindings": [
                (
                    binding.id,
                    binding.name.root,
                    binding.description,
                    [config.model_dump(mode="json") for config in (binding.output_configs or [])],
                    binding.input_mapping.model_dump(mode="json"),
                    binding.user_id,
                    binding.updated_at,
                )
                for binding in dataset_bindings
            ],
            "project_bindings": [
                (
                    binding.id,
                    binding.name.root,
                    binding.filter_condition,
                    binding.evaluation_target,
                    binding.evaluation_delay_seconds,
                    binding.input_mapping.model_dump(mode="json")
                    if binding.input_mapping is not None
                    else None,
                    binding.sampling_rate,
                    binding.enabled,
                    binding.updated_at,
                )
                for binding in project_bindings
            ],
        }


@pytest.mark.parametrize(
    ("binding_type", "other_binding_type"),
    [
        ("project", "dataset"),
        ("project", "project"),
        ("dataset", "dataset"),
        ("dataset", "project"),
    ],
)
async def test_llm_edit_keeps_shared_name_when_another_binding_exists(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    binding_type: str,
    other_binding_type: str,
) -> None:
    evaluator_id, mutation, update_input = await _undescribed_evaluator(
        gql_client, db, binding_type
    )
    other_binding_id = (
        await _add_compatible_dataset_override(
            db, evaluator_id, description="correctness", labels=_EVALUATOR_LABELS
        )
        if other_binding_type == "dataset"
        else await _add_project_binding(db, evaluator_id)
    )
    before = await _llm_edit_state(db, evaluator_id)

    result = await gql_client.execute(
        mutation,
        {
            "input": _change_llm_definition(update_input),
        },
    )

    assert result.data and not result.errors
    after = await _llm_edit_state(db, evaluator_id)
    assert after["name"] == before["name"]
    assert after["tag_version_id"] != before["tag_version_id"]
    async with db() as session:
        evaluator = await session.get(models.LLMEvaluator, evaluator_id)
        assert evaluator is not None
        assert evaluator.name.root == before["name"]
        if other_binding_type == "dataset":
            dataset_binding = await session.get(models.DatasetEvaluators, other_binding_id)
            assert dataset_binding is not None
            assert dataset_binding.description == "correctness"
            assert dataset_binding.output_configs == [_output_config(_EVALUATOR_LABELS)]
        else:
            project_binding = await session.get(models.ProjectEvaluator, other_binding_id)
            assert project_binding is not None
        if binding_type == "dataset":
            edited_binding_id = int(GlobalID.from_id(update_input["datasetEvaluatorId"]).node_id)
            edited_binding_name = await session.scalar(
                select(models.DatasetEvaluators.name).where(
                    models.DatasetEvaluators.id == edited_binding_id
                )
            )
        else:
            edited_binding_id = int(GlobalID.from_id(update_input["projectEvaluatorId"]).node_id)
            edited_binding_name = await session.scalar(
                select(models.ProjectEvaluator.name).where(
                    models.ProjectEvaluator.id == edited_binding_id
                )
            )
        assert edited_binding_name is not None
        assert edited_binding_name.root == f"edited-{update_input['name']}"
