"""Moving an LLM evaluator's prompt version tag from the prompt side gets the evaluator's checks,
and deleting it is refused."""

import asyncio
from datetime import datetime, timezone
from secrets import token_hex
from typing import Any, AsyncIterator, Awaitable, Callable, Coroutine, Optional, Sequence, TypeVar
from urllib.parse import quote_plus

import httpx
import pytest
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
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
from phoenix.server.api.helpers.evaluators import (
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.helpers.prompt_version_tags import validate_prompt_version_tag_move
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_T = TypeVar("_T")

_EVALUATOR_LABELS = ("correct", "incorrect")


def _prompt_version(
    text: str,
    labels: Sequence[str] = _EVALUATOR_LABELS,
    tool_description: str = "correctness",
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
                        description=tool_description,
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
        self.pinned_version, self.compatible_version, self.incompatible_version = (
            prompt.prompt_versions
        )
        tag = evaluator.prompt_version_tag
        assert tag is not None
        self.tag = tag
        self.tag_name = tag.name.root
        self.evaluator_gid = str(GlobalID("LLMEvaluator", str(evaluator.id)))
        self.updated_at = evaluator.updated_at


@pytest.fixture
async def pinned(db: DbSessionFactory) -> AsyncIterator[_Fixture]:
    """An evaluator whose tag pins the first of three versions.

    The second version keeps the evaluator's label set; the third uses different labels, so
    the evaluator cannot run it.
    """
    prompt = models.Prompt(
        name=Identifier.model_validate(f"tag-move-prompt-{token_hex(4)}"),
        description="tag move",
        prompt_versions=[
            _prompt_version("Judge {{output}}"),
            _prompt_version("Grade {{output}}"),
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


@pytest.fixture
async def dataset_override(db: DbSessionFactory, pinned: _Fixture) -> AsyncIterator[str]:
    """A dataset binding whose output override adds a label the evaluator's versions lack."""
    binding = models.DatasetEvaluators(
        dataset=models.Dataset(name=f"tag-move-dataset-{token_hex(4)}", metadata_={}),
        evaluator_id=pinned.evaluator.id,
        name=pinned.evaluator.name,
        input_mapping=InputMapping(literal_mapping={}, path_mapping={"output": "$.output"}),
        output_configs=[_output_config(("correct", "incorrect", "unsure"))],
        project=models.Project(name=f"tag-move-project-{token_hex(4)}"),
    )
    async with db() as session:
        session.add(binding)
    yield str(GlobalID("DatasetEvaluator", str(binding.id)))
    async with db() as session:
        await session.execute(
            sa.delete(models.DatasetEvaluators).where(models.DatasetEvaluators.id == binding.id)
        )
        await session.execute(
            sa.delete(models.Dataset).where(models.Dataset.id == binding.dataset_id)
        )
        await session.execute(
            sa.delete(models.Project).where(models.Project.id == binding.project_id)
        )


class _EvaluatorState:
    def __init__(self, tag_id: Optional[int], tag_target: Optional[int], updated_at: datetime):
        self.tag_id = tag_id
        self.tag_target = tag_target
        self.updated_at = updated_at


async def _state(db: DbSessionFactory, evaluator_id: int) -> _EvaluatorState:
    async with db() as session:
        evaluator = await session.get(models.LLMEvaluator, evaluator_id)
        assert evaluator is not None
        target = (
            await session.scalar(
                select(models.PromptVersionTag.prompt_version_id).where(
                    models.PromptVersionTag.id == evaluator.prompt_version_tag_id
                )
            )
            if evaluator.prompt_version_tag_id is not None
            else None
        )
    return _EvaluatorState(evaluator.prompt_version_tag_id, target, evaluator.updated_at)


async def _version_count(db: DbSessionFactory, prompt_id: int) -> int:
    async with db() as session:
        count = await session.scalar(
            select(sa.func.count(models.PromptVersion.id)).where(
                models.PromptVersion.prompt_id == prompt_id
            )
        )
    assert count is not None
    return count


async def _tag_exists(db: DbSessionFactory, tag_id: int) -> bool:
    async with db() as session:
        return await session.get(models.PromptVersionTag, tag_id) is not None


async def _add_tag(db: DbSessionFactory, version: models.PromptVersion) -> models.PromptVersionTag:
    """Tag the version with a tag no evaluator uses."""
    tag = models.PromptVersionTag(
        name=Identifier.model_validate(f"staging-{token_hex(4)}"),
        prompt_id=version.prompt_id,
        prompt_version_id=version.id,
    )
    async with db() as session:
        session.add(tag)
    return tag


def _gid(version: models.PromptVersion) -> str:
    return str(GlobalID("PromptVersion", str(version.id)))


def _path(version: models.PromptVersion) -> str:
    return quote_plus(_gid(version))


class TestRestRoutes:
    async def test_tag_moves_to_a_version_the_evaluator_can_run(
        self, httpx_client: httpx.AsyncClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        response = await httpx_client.post(
            f"v1/prompt_versions/{_path(pinned.compatible_version)}/tags",
            json={"name": pinned.tag_name},
        )
        assert response.status_code == 204, response.text
        state = await _state(db, pinned.evaluator.id)
        assert state.tag_target == pinned.compatible_version.id
        assert state.updated_at > pinned.updated_at

    async def test_tag_does_not_move_to_a_version_the_evaluator_cannot_run(
        self, httpx_client: httpx.AsyncClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        response = await httpx_client.post(
            f"v1/prompt_versions/{_path(pinned.incompatible_version)}/tags",
            json={"name": pinned.tag_name},
        )
        assert response.status_code == 409, response.text
        assert pinned.evaluator_gid in response.text
        state = await _state(db, pinned.evaluator.id)
        assert state.tag_target == pinned.pinned_version.id
        assert state.updated_at == pinned.updated_at

    async def test_tag_does_not_move_when_a_dataset_override_cannot_follow(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
        pinned: _Fixture,
        dataset_override: str,
    ) -> None:
        response = await httpx_client.post(
            f"v1/prompt_versions/{_path(pinned.compatible_version)}/tags",
            json={"name": pinned.tag_name},
        )
        assert response.status_code == 409, response.text
        assert dataset_override in response.text
        assert (await _state(db, pinned.evaluator.id)).tag_target == pinned.pinned_version.id

    async def test_other_tags_move_freely(
        self, httpx_client: httpx.AsyncClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        response = await httpx_client.post(
            f"v1/prompt_versions/{_path(pinned.incompatible_version)}/tags",
            json={"name": "staging"},
        )
        assert response.status_code == 204, response.text
        assert (await _state(db, pinned.evaluator.id)).tag_target == pinned.pinned_version.id

    async def test_deleting_the_tag_is_refused(
        self, httpx_client: httpx.AsyncClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        response = await httpx_client.delete(
            f"v1/prompt_versions/{_path(pinned.pinned_version)}/tags/{quote_plus(pinned.tag_name)}"
        )
        assert response.status_code == 409, response.text
        assert pinned.evaluator_gid in response.text
        assert await _tag_exists(db, pinned.tag.id)
        state = await _state(db, pinned.evaluator.id)
        assert state.tag_id == pinned.tag.id
        assert state.tag_target == pinned.pinned_version.id
        assert state.updated_at == pinned.updated_at

    async def test_other_tags_delete_freely(
        self, httpx_client: httpx.AsyncClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        tag = await _add_tag(db, pinned.pinned_version)
        response = await httpx_client.delete(
            f"v1/prompt_versions/{_path(pinned.pinned_version)}/tags/{quote_plus(tag.name.root)}"
        )
        assert response.status_code == 204, response.text
        assert not await _tag_exists(db, tag.id)
        assert (await _state(db, pinned.evaluator.id)).tag_id == pinned.tag.id

    async def test_creating_a_version_carries_the_tag_only_if_the_evaluator_can_run_it(
        self, httpx_client: httpx.AsyncClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        content: dict[str, Any] = (
            await httpx_client.get(f"v1/prompt_versions/{_path(pinned.pinned_version)}")
        ).json()["data"]
        content.pop("id")
        prompt_path = quote_plus(str(GlobalID("Prompt", str(pinned.prompt.id))))
        tags = [{"name": pinned.tag_name}]

        response = await httpx_client.post(
            f"v1/prompts/{prompt_path}/versions", json={"version": content, "tags": tags}
        )
        assert response.status_code == 201, response.text
        created_id = GlobalID.from_id(response.json()["data"]["id"]).node_id
        assert (await _state(db, pinned.evaluator.id)).tag_target == int(created_id)

        content["tools"]["tools"][0]["function"]["parameters"]["properties"]["label"]["enum"] = [
            "good",
            "bad",
        ]
        response = await httpx_client.post(
            f"v1/prompts/{prompt_path}/versions", json={"version": content, "tags": tags}
        )
        assert response.status_code == 409, response.text
        assert pinned.evaluator_gid in response.text
        assert await _version_count(db, pinned.prompt.id) == 4
        assert (await _state(db, pinned.evaluator.id)).tag_target == int(created_id)


class TestGraphQLMutations:
    _SET_TAG = """
        mutation($input: SetPromptVersionTagInput!) {
          setPromptVersionTag(input: $input) { promptVersionTag { id } }
        }
    """

    async def test_set_tag_moves_only_to_a_version_the_evaluator_can_run(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        result = await gql_client.execute(
            self._SET_TAG,
            {
                "input": {
                    "promptVersionId": _gid(pinned.incompatible_version),
                    "name": pinned.tag_name,
                }
            },
        )
        assert result.errors and "cannot run the target version" in result.errors[0].message
        assert pinned.evaluator_gid in result.errors[0].message
        assert (await _state(db, pinned.evaluator.id)).tag_target == pinned.pinned_version.id

        result = await gql_client.execute(
            self._SET_TAG,
            {
                "input": {
                    "promptVersionId": _gid(pinned.compatible_version),
                    "name": pinned.tag_name,
                }
            },
        )
        assert not result.errors, result.errors
        assert (await _state(db, pinned.evaluator.id)).tag_target == pinned.compatible_version.id

    _DELETE_TAG = """
        mutation($input: DeletePromptVersionTagInput!) {
          deletePromptVersionTag(input: $input) { prompt { id } }
        }
    """

    async def test_delete_tag_is_refused(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        result = await gql_client.execute(
            self._DELETE_TAG,
            {
                "input": {
                    "promptVersionTagId": str(GlobalID("PromptVersionTag", str(pinned.tag.id)))
                }
            },
        )
        assert result.errors and "cannot be deleted" in result.errors[0].message
        assert pinned.evaluator_gid in result.errors[0].message
        assert await _tag_exists(db, pinned.tag.id)
        state = await _state(db, pinned.evaluator.id)
        assert state.tag_id == pinned.tag.id
        assert state.tag_target == pinned.pinned_version.id

    async def test_delete_other_tag(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        tag = await _add_tag(db, pinned.pinned_version)
        result = await gql_client.execute(
            self._DELETE_TAG,
            {"input": {"promptVersionTagId": str(GlobalID("PromptVersionTag", str(tag.id)))}},
        )
        assert not result.errors, result.errors
        assert not await _tag_exists(db, tag.id)
        assert (await _state(db, pinned.evaluator.id)).tag_id == pinned.tag.id

    async def test_delete_missing_tag_is_not_found(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        missing_id = pinned.tag.id + 1_000_000
        assert not await _tag_exists(db, missing_id)
        tag_gid = str(GlobalID("PromptVersionTag", str(missing_id)))
        result = await gql_client.execute(
            self._DELETE_TAG, {"input": {"promptVersionTagId": tag_gid}}
        )
        assert result.errors
        assert result.errors[0].message == f"PromptVersionTag with ID {tag_gid} not found"

    async def test_creating_a_version_the_evaluator_cannot_run_does_not_carry_the_tag(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        result = await gql_client.execute(
            """
            mutation($input: CreateChatPromptVersionInput!) {
              createChatPromptVersion(input: $input) { id }
            }
            """,
            {
                "input": {
                    "promptId": str(GlobalID("Prompt", str(pinned.prompt.id))),
                    "tags": [{"name": pinned.tag_name}],
                    "promptVersion": {
                        "templateFormat": "MUSTACHE",
                        "template": {
                            "messages": [
                                {"role": "USER", "content": [{"text": {"text": "Rate {{output}}"}}]}
                            ]
                        },
                        "modelProvider": "OPENAI",
                        "modelName": "gpt-4o-mini",
                        "invocationParameters": {"openai": {}},
                    },
                }
            },
        )
        assert result.errors and "cannot run the target version" in result.errors[0].message
        assert await _version_count(db, pinned.prompt.id) == 3
        assert (await _state(db, pinned.evaluator.id)).tag_target == pinned.pinned_version.id


async def _behind(
    db: DbSessionFactory,
    hold: Callable[[AsyncSession], Awaitable[None]],
    waiter: Callable[[], Coroutine[Any, Any, _T]],
) -> _T:
    """Leave hold's writes uncommitted, show that waiter blocks behind them, then commit them.

    Returns what waiter returns once it has run against the committed writes.
    """
    holding = asyncio.Event()
    release = asyncio.Event()

    async def held() -> None:
        async with db() as session:
            await hold(session)
            await session.flush()
            holding.set()
            await release.wait()

    other = asyncio.create_task(held())
    try:
        await asyncio.wait_for(holding.wait(), timeout=10)
        waiting: asyncio.Task[_T] = asyncio.create_task(waiter())
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(asyncio.shield(waiting), timeout=0.5)
    finally:
        release.set()
        await other
    return await waiting


def _relabel(pinned: _Fixture) -> Callable[[AsyncSession], Awaitable[None]]:
    """An evaluator edit that relabels the outputs good/bad and moves the tag to match."""

    async def edit(session: AsyncSession) -> None:
        evaluator = await session.get(
            models.LLMEvaluator, pinned.evaluator.id, with_for_update=True
        )
        assert evaluator is not None
        evaluator.output_configs = [_output_config(("good", "bad"))]
        evaluator.updated_at = datetime.now(timezone.utc)
        tag = await session.get(models.PromptVersionTag, pinned.tag.id)
        assert tag is not None
        tag.prompt_version_id = pinned.incompatible_version.id

    return edit


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


async def _add_grading_version(db: DbSessionFactory, evaluator_id: int) -> tuple[int, int, int]:
    """Add a version to the evaluator's prompt whose tool describes itself as "grading".

    An evaluator without a description can run it, but not once it takes the description
    "correctness". Returns the evaluator's tag, the version the tag names, and the new version.
    """
    async with db() as session:
        evaluator = await session.get(models.LLMEvaluator, evaluator_id)
        assert evaluator is not None and evaluator.prompt_version_tag_id is not None
        tag = await session.get(models.PromptVersionTag, evaluator.prompt_version_tag_id)
        assert tag is not None
        version = _prompt_version("Grade {{output}}", tool_description="grading")
        version.prompt_id = evaluator.prompt_id
        session.add(version)
        await session.flush()
        return tag.id, tag.prompt_version_id, version.id


def _move_tag(tag_id: int, prompt_version_id: int) -> Callable[[AsyncSession], Awaitable[None]]:
    """A tag move from the prompt side."""

    async def move(session: AsyncSession) -> None:
        tag = await session.get(models.PromptVersionTag, tag_id)
        assert tag is not None
        await validate_prompt_version_tag_move(session, tag, prompt_version_id)
        tag.prompt_version_id = prompt_version_id

    return move


@pytest.mark.postgres_only
class TestConcurrentWrites:
    """Tag moves and evaluator edits serialize on the evaluator row."""

    async def test_tag_move_behind_an_edit_checks_the_outputs_the_edit_committed(
        self, gql_client: AsyncGraphQLClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        result = await _behind(
            db,
            _relabel(pinned),
            lambda: gql_client.execute(
                TestGraphQLMutations._SET_TAG,
                {
                    "input": {
                        "promptVersionId": _gid(pinned.compatible_version),
                        "name": pinned.tag_name,
                    }
                },
            ),
        )
        assert result.errors and "cannot run the target version" in result.errors[0].message
        assert (await _state(db, pinned.evaluator.id)).tag_target == pinned.incompatible_version.id

    async def test_retag_in_place_behind_an_edit_that_moves_the_tag_is_checked(
        self, httpx_client: httpx.AsyncClient, db: DbSessionFactory, pinned: _Fixture
    ) -> None:
        """Pointing the tag at the version it already names is a move once the edit commits."""
        response = await _behind(
            db,
            _relabel(pinned),
            lambda: httpx_client.post(
                f"v1/prompt_versions/{_path(pinned.pinned_version)}/tags",
                json={"name": pinned.tag_name},
            ),
        )
        assert response.status_code == 409, response.text
        assert (await _state(db, pinned.evaluator.id)).tag_target == pinned.incompatible_version.id

    @pytest.mark.parametrize("binding", ["project", "dataset"])
    async def test_edit_behind_a_tag_move_reads_the_moved_tag(
        self, binding: str, gql_client: AsyncGraphQLClient, db: DbSessionFactory
    ) -> None:
        """The edit sets a description the moved-to version's tool does not carry.

        A project edit compares its prompt content with the version the tag names, which after
        the move no longer matches, so the content is saved as a new version. A dataset edit
        names the version it started from and points the tag back at it.
        """
        evaluator_id, mutation, update_input = await _undescribed_evaluator(gql_client, db, binding)
        tag_id, started_from_id, moved_to_id = await _add_grading_version(db, evaluator_id)
        if binding == "dataset":
            update_input["promptVersionId"] = str(GlobalID("PromptVersion", str(started_from_id)))
        result = await _behind(
            db,
            _move_tag(tag_id, moved_to_id),
            lambda: gql_client.execute(
                mutation, {"input": {**update_input, "description": "correctness"}}
            ),
        )
        assert result.data and not result.errors, result.errors
        async with db() as session:
            evaluator = await session.get(models.LLMEvaluator, evaluator_id)
            assert evaluator is not None and evaluator.description == "correctness"
            runs = await session.scalar(
                select(models.PromptVersion)
                .join(
                    models.PromptVersionTag,
                    models.PromptVersionTag.prompt_version_id == models.PromptVersion.id,
                )
                .where(models.PromptVersionTag.id == evaluator.prompt_version_tag_id)
            )
            assert runs is not None
            validate_consistent_llm_evaluator_and_prompt_version(runs, evaluator)
        if binding == "project":
            assert runs.id not in (started_from_id, moved_to_id)
        else:
            assert runs.id == started_from_id
