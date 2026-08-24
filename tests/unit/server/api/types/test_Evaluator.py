from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, AsyncIterator

import pytest
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.eval_work import MAX_ATTEMPTS, SESSION_CONTENT_INCOMPLETE_ERROR
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.api.types.Evaluator import (
    BuiltInEvaluator,
    DatasetEvaluator,
    LLMEvaluator,
)
from phoenix.server.online_eval.derivation import STALE_FINGERPRINT_ERROR
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


def _create_prompt_version(prompt_id: int, template: str, model: str) -> models.PromptVersion:
    """Helper to create a prompt version with consistent defaults."""
    return models.PromptVersion(
        prompt_id=prompt_id,
        template_type=PromptTemplateType.STRING,
        template_format=PromptTemplateFormat.F_STRING,
        template=PromptStringTemplate(type="string", template=template),
        invocation_parameters=PromptOpenAIInvocationParameters(
            type="openai", openai=PromptOpenAIInvocationParametersContent()
        ),
        tools=None,
        response_format=None,
        model_provider=ModelProvider.OPENAI,
        model_name=model,
        metadata_={},
    )


class TestEvaluatorFields:
    """Tests for evaluator polymorphism and field resolution."""

    @pytest.fixture
    async def _test_data(self, db: DbSessionFactory) -> AsyncIterator[dict[str, Any]]:
        """Create test data: prompt with 2 versions, 1 tag pointing to v1, 2 evaluators,
        and dataset evaluator assignments for the untagged evaluator."""
        async with db() as session:
            prompt = models.Prompt(name=Identifier(token_hex(4)))
            session.add(prompt)
            await session.flush()

            v1, v2 = (
                _create_prompt_version(prompt.id, "V1: {input}", "gpt-4"),
                _create_prompt_version(prompt.id, "V2: {input}", "gpt-3.5-turbo"),
            )
            session.add_all([v1, v2])
            await session.flush()

            tag = models.PromptVersionTag(
                name=Identifier(token_hex(4)), prompt_id=prompt.id, prompt_version_id=v1.id
            )
            session.add(tag)
            await session.flush()

            untagged = models.LLMEvaluator(
                name=Identifier(token_hex(4)),
                prompt_id=prompt.id,
                metadata_={"key": "value", "count": 42},
            )
            tagged = models.LLMEvaluator(
                name=Identifier(token_hex(4)),
                prompt_id=prompt.id,
                prompt_version_tag_id=tag.id,
                metadata_=None,
            )
            session.add_all([untagged, tagged])
            await session.flush()

            # Dataset evaluator assignments for the untagged evaluator
            dataset_a = models.Dataset(name=f"dataset-a-{token_hex(4)}", metadata_={})
            dataset_b = models.Dataset(name=f"dataset-b-{token_hex(4)}", metadata_={})
            session.add_all([dataset_a, dataset_b])
            await session.flush()

            de_1 = models.DatasetEvaluators(
                dataset_id=dataset_a.id,
                evaluator_id=untagged.id,
                name=Identifier("de_one"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name=f"{dataset_a.name}/de_one"),
            )
            de_2 = models.DatasetEvaluators(
                dataset_id=dataset_b.id,
                evaluator_id=untagged.id,
                name=Identifier("de_two"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name=f"{dataset_b.name}/de_two"),
            )
            session.add_all([de_1, de_2])
            await session.flush()

            # Project evaluator associations for the untagged evaluator
            project_a = models.Project(name=f"project-a-{token_hex(4)}")
            project_b = models.Project(name=f"project-b-{token_hex(4)}")
            session.add_all([project_a, project_b])
            await session.flush()

            criteria_1 = models.ProjectEvaluator(
                trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
                project_id=project_a.id,
                evaluator_id=untagged.id,
                name=Identifier("criteria_one"),
                filter_condition="",
                sampling_rate=1.0,
                evaluation_target="SPAN",
            )
            criteria_2 = models.ProjectEvaluator(
                trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
                project_id=project_b.id,
                evaluator_id=untagged.id,
                name=Identifier("criteria_two"),
                filter_condition="",
                sampling_rate=1.0,
                evaluation_target="SPAN",
            )
            session.add_all([criteria_1, criteria_2])
            await session.flush()

        ids = {
            "prompt": prompt.id,
            "v1": v1.id,
            "v2": v2.id,
            "tag": tag.id,
            "untagged": untagged.id,
            "tagged": tagged.id,
            "de_1": de_1.id,
            "de_2": de_2.id,
            "project_a": project_a.id,
            "project_b": project_b.id,
        }
        yield ids

    async def test_llm_evaluator_fields(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test LLMEvaluator interface fields, relationships, and version resolution logic."""
        # Test untagged evaluator: interface fields, promptVersion returns latest, and metadata is non-null
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on Evaluator { id name kind metadata createdAt updatedAt }
                    ... on LLMEvaluator { prompt { id } promptVersion { id } }
                }
            }""",
            variables={"id": str(GlobalID(LLMEvaluator.__name__, str(_test_data["untagged"])))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["kind"] == "LLM"
        assert node["createdAt"] and node["updatedAt"]
        assert node["metadata"] == {"key": "value", "count": 42}
        assert node["prompt"]["id"] == str(GlobalID("Prompt", str(_test_data["prompt"])))
        assert node["promptVersion"]["id"] == str(GlobalID("PromptVersion", str(_test_data["v2"])))

        # Test tagged evaluator: promptVersionTag exists, promptVersion returns tagged version, and metadata is null
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on Evaluator { metadata }
                    ... on LLMEvaluator {
                        promptVersionTag { id }
                        promptVersion { id }
                    }
                }
            }""",
            variables={"id": str(GlobalID(LLMEvaluator.__name__, str(_test_data["tagged"])))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["metadata"] == {}
        assert node["promptVersionTag"]["id"] == str(
            GlobalID("PromptVersionTag", str(_test_data["tag"]))
        )
        assert node["promptVersion"]["id"] == str(GlobalID("PromptVersion", str(_test_data["v1"])))

    async def test_dataset_evaluators_field(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test Evaluator.datasetEvaluators returns associated assignments or empty list."""
        # Untagged evaluator has two dataset evaluator assignments
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on LLMEvaluator {
                        datasetEvaluators { id name }
                    }
                }
            }""",
            variables={"id": str(GlobalID(LLMEvaluator.__name__, str(_test_data["untagged"])))},
        )
        assert not resp.errors and resp.data
        dataset_evaluators = resp.data["node"]["datasetEvaluators"]
        assert len(dataset_evaluators) == 2
        returned_ids = {de["id"] for de in dataset_evaluators}
        expected_ids = {
            str(GlobalID(DatasetEvaluator.__name__, str(_test_data["de_1"]))),
            str(GlobalID(DatasetEvaluator.__name__, str(_test_data["de_2"]))),
        }
        assert returned_ids == expected_ids
        assert {de["name"] for de in dataset_evaluators} == {"de_one", "de_two"}

        # Tagged evaluator has no dataset evaluator assignments
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on LLMEvaluator {
                        datasetEvaluators { id }
                    }
                }
            }""",
            variables={"id": str(GlobalID(LLMEvaluator.__name__, str(_test_data["tagged"])))},
        )
        assert not resp.errors and resp.data
        assert resp.data["node"]["datasetEvaluators"] == []

    async def test_projects_field(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        # Untagged evaluator is attached to two projects as a project evaluator
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on Evaluator {
                        projects(first: 10) {
                            edges { node { id name } }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID(LLMEvaluator.__name__, str(_test_data["untagged"])))},
        )
        assert not resp.errors and resp.data
        projects = [edge["node"] for edge in resp.data["node"]["projects"]["edges"]]
        returned_ids = [project["id"] for project in projects]
        # Sorted by project name ascending: project-a before project-b
        assert returned_ids == [
            str(GlobalID("Project", str(_test_data["project_a"]))),
            str(GlobalID("Project", str(_test_data["project_b"]))),
        ]

        # Tagged evaluator is not attached to any project
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on Evaluator {
                        projects(first: 10) {
                            edges { node { id } }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID(LLMEvaluator.__name__, str(_test_data["tagged"])))},
        )
        assert not resp.errors and resp.data
        assert resp.data["node"]["projects"]["edges"] == []


async def test_project_evaluator_scheduling_fields(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    async with db() as session:
        project = models.Project(name=f"project-{token_hex(4)}")
        evaluator = models.BuiltinEvaluator(
            name=Identifier(f"evaluator-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add_all([project, evaluator])
        await session.flush()
        project_evaluator = models.ProjectEvaluator(
            trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(f"project-evaluator-name-{token_hex(4)}"),
            evaluation_target="SESSION",
            filter_condition="span_kind == 'LLM'",
            sampling_rate=1.0,
            evaluation_delay_seconds=45,
        )
        session.add(project_evaluator)
        await session.flush()
        project_id = project.id

    response = await gql_client.execute(
        """query ($id: ID!) {
            node(id: $id) {
                ... on Project {
                    evaluators {
                        edges {
                            node {
                                evaluationDelaySeconds
                                schedulabilityStatus
                                schedulabilityReason
                            }
                        }
                    }
                }
            }
        }""",
        variables={"id": str(GlobalID("Project", str(project_id)))},
    )

    assert not response.errors and response.data
    edges = response.data["node"]["evaluators"]["edges"]
    assert [edge["node"]["evaluationDelaySeconds"] for edge in edges] == [45]
    assert [edge["node"]["schedulabilityStatus"] for edge in edges] == ["SCHEDULABLE"]
    assert [edge["node"]["schedulabilityReason"] for edge in edges] == [None]


class TestDatasetEvaluatorDescriptionFallback:
    """Tests for DatasetEvaluator.description fallback behavior."""

    @pytest.fixture
    async def _test_data(self, db: DbSessionFactory) -> AsyncIterator[dict[str, Any]]:
        """Create test data: dataset, LLM evaluator with description, and dataset evaluators."""
        async with db() as session:
            dataset = models.Dataset(
                name=f"test-dataset-{token_hex(4)}",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            prompt = models.Prompt(name=Identifier(token_hex(4)))
            session.add(prompt)
            await session.flush()

            prompt_version = _create_prompt_version(prompt.id, "Test: {input}", "gpt-4")
            session.add(prompt_version)
            await session.flush()

            llm_evaluator = models.LLMEvaluator(
                name=Identifier(token_hex(4)),
                prompt_id=prompt.id,
                description="Base evaluator description",
                output_configs=[
                    CategoricalOutputConfig(
                        type="CATEGORICAL",
                        name="result",
                        optimization_direction=OptimizationDirection.MINIMIZE,
                        values=[
                            CategoricalAnnotationValue(label="good", score=1.0),
                            CategoricalAnnotationValue(label="bad", score=0.0),
                        ],
                    )
                ],
            )
            session.add(llm_evaluator)
            await session.flush()

            dataset_evaluator_with_desc = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=llm_evaluator.id,
                name=Identifier("eval_with_desc"),
                description="Dataset evaluator override description",
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(
                    name=f"{dataset.name}/eval_with_desc",
                    description="Project for dataset evaluator with description",
                ),
            )
            session.add(dataset_evaluator_with_desc)
            await session.flush()

            dataset_evaluator_no_desc = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=llm_evaluator.id,
                name=Identifier("eval_no_desc"),
                description=None,
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(
                    name=f"{dataset.name}/eval_no_desc",
                    description="Project for dataset evaluator without description",
                ),
            )
            session.add(dataset_evaluator_no_desc)
            await session.flush()

            llm_evaluator_no_desc = models.LLMEvaluator(
                name=Identifier(token_hex(4)),
                prompt_id=prompt.id,
                description=None,
                output_configs=[
                    CategoricalOutputConfig(
                        type="CATEGORICAL",
                        name="result2",
                        optimization_direction=OptimizationDirection.MINIMIZE,
                        values=[
                            CategoricalAnnotationValue(label="good", score=1.0),
                            CategoricalAnnotationValue(label="bad", score=0.0),
                        ],
                    )
                ],
            )
            session.add(llm_evaluator_no_desc)
            await session.flush()

            # Create project for dataset evaluator with both null descriptions
            project_both_null = models.Project(
                name=f"{dataset.name}/eval_both_null",
                description="Project for dataset evaluator both null",
            )
            session.add(project_both_null)
            await session.flush()

            dataset_evaluator_both_null = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=llm_evaluator_no_desc.id,
                name=Identifier("eval_both_null"),
                description=None,
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project_id=project_both_null.id,
            )
            session.add(dataset_evaluator_both_null)
            await session.flush()

        ids = {
            "dataset": dataset.id,
            "llm_evaluator": llm_evaluator.id,
            "dataset_evaluator_with_desc": dataset_evaluator_with_desc.id,
            "dataset_evaluator_no_desc": dataset_evaluator_no_desc.id,
            "llm_evaluator_no_desc": llm_evaluator_no_desc.id,
            "dataset_evaluator_both_null": dataset_evaluator_both_null.id,
        }
        yield ids

    async def test_dataset_evaluator_returns_own_description_when_set(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """When dataset evaluator has its own description, it should return that."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator { description }
                }
            }""",
            variables={
                "id": str(
                    GlobalID(
                        DatasetEvaluator.__name__, str(_test_data["dataset_evaluator_with_desc"])
                    )
                )
            },
        )
        assert not resp.errors and resp.data
        assert resp.data["node"]["description"] == "Dataset evaluator override description"

    async def test_dataset_evaluator_falls_back_to_base_evaluator_description(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """When dataset evaluator description is null, it should return base evaluator's description."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator { description }
                }
            }""",
            variables={
                "id": str(
                    GlobalID(
                        DatasetEvaluator.__name__, str(_test_data["dataset_evaluator_no_desc"])
                    )
                )
            },
        )
        assert not resp.errors and resp.data
        assert resp.data["node"]["description"] == "Base evaluator description"

    async def test_dataset_evaluator_returns_null_when_both_null(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """When both dataset evaluator and base evaluator descriptions are null, it returns null."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator { description }
                }
            }""",
            variables={
                "id": str(
                    GlobalID(
                        DatasetEvaluator.__name__, str(_test_data["dataset_evaluator_both_null"])
                    )
                )
            },
        )
        assert not resp.errors and resp.data
        assert resp.data["node"]["description"] is None


class TestBuiltInEvaluatorOutputConfig:
    """Tests for BuiltInEvaluator.outputConfigs field resolution."""

    async def test_categorical_builtin_returns_categorical_output_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        synced_builtin_evaluators: None,
    ) -> None:
        """Test that Contains evaluator returns an CategoricalAnnotationConfig."""
        from sqlalchemy import select

        # Look up the evaluator ID from the database by key
        async with db() as session:
            evaluator_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
            )
        assert evaluator_id is not None

        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on BuiltInEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on CategoricalAnnotationConfig {
                                name
                                optimizationDirection
                                values { label score }
                            }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID(BuiltInEvaluator.__name__, str(evaluator_id)))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "contains"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list) and len(output_configs) >= 1
        output_config = output_configs[0]
        assert output_config["__typename"] == "CategoricalAnnotationConfig"
        assert output_config["name"] == "contains"
        assert output_config["optimizationDirection"] == "MAXIMIZE"
        assert len(output_config["values"]) == 2
        labels = {v["label"] for v in output_config["values"]}
        assert labels == {"true", "false"}

    async def test_continuous_builtin_returns_continuous_output_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        synced_builtin_evaluators: None,
    ) -> None:
        """Test that LevenshteinDistance evaluator returns an ContinuousAnnotationConfig."""
        from sqlalchemy import select

        # Look up the evaluator ID from the database by key
        async with db() as session:
            evaluator_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(
                    models.BuiltinEvaluator.key == "levenshtein_distance"
                )
            )
        assert evaluator_id is not None

        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on BuiltInEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on ContinuousAnnotationConfig {
                                name
                                optimizationDirection
                                lowerBound
                                upperBound
                            }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID(BuiltInEvaluator.__name__, str(evaluator_id)))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "levenshtein_distance"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list) and len(output_configs) >= 1
        output_config = output_configs[0]
        assert output_config["__typename"] == "ContinuousAnnotationConfig"
        assert output_config["name"] == "levenshtein_distance"
        assert output_config["optimizationDirection"] == "MINIMIZE"
        assert output_config["lowerBound"] == 0.0
        assert output_config["upperBound"] is None


class TestDatasetEvaluatorBuiltinOutputConfig:
    """Tests for DatasetEvaluator.outputConfigs with builtin evaluators."""

    @pytest.fixture
    async def _test_data(
        self, db: DbSessionFactory, synced_builtin_evaluators: None
    ) -> AsyncIterator[dict[str, Any]]:
        """Create test data: dataset with builtin evaluator assignments."""
        from sqlalchemy import select

        async with db() as session:
            project = models.Project(name=f"test-project-{token_hex(4)}")
            session.add(project)
            await session.flush()

            dataset = models.Dataset(
                name=f"test-dataset-{token_hex(4)}",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            # Look up the builtin evaluator IDs from the database by key
            contains_evaluator_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
            )
            levenshtein_evaluator_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(
                    models.BuiltinEvaluator.key == "levenshtein_distance"
                )
            )
            assert contains_evaluator_id is not None
            assert levenshtein_evaluator_id is not None

            dataset_eval_categorical_no_override = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=contains_evaluator_id,
                name=Identifier("contains_no_override"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[],
                project_id=project.id,
            )
            session.add(dataset_eval_categorical_no_override)
            await session.flush()

            dataset_eval_categorical_with_override = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=contains_evaluator_id,
                name=Identifier("contains_with_override"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[
                    CategoricalOutputConfig(
                        type="CATEGORICAL",
                        name="contains",
                        optimization_direction=OptimizationDirection.MINIMIZE,
                        values=[
                            CategoricalAnnotationValue(label="yes", score=1.0),
                            CategoricalAnnotationValue(label="no", score=0.0),
                        ],
                    )
                ],
                description="Overridden description",
                project_id=project.id,
            )
            session.add(dataset_eval_categorical_with_override)
            await session.flush()

            dataset_eval_continuous_no_override = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=levenshtein_evaluator_id,
                name=Identifier("levenshtein_no_override"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[],
                project_id=project.id,
            )
            session.add(dataset_eval_continuous_no_override)
            await session.flush()

            dataset_eval_continuous_with_override = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=levenshtein_evaluator_id,
                name=Identifier("levenshtein_with_override"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[
                    ContinuousOutputConfig(
                        type="CONTINUOUS",
                        name="levenshtein_distance",
                        optimization_direction=OptimizationDirection.MINIMIZE,
                        lower_bound=0.1,
                        upper_bound=0.9,
                    )
                ],
                project_id=project.id,
            )
            session.add(dataset_eval_continuous_with_override)
            await session.flush()

        ids = {
            "dataset": dataset.id,
            "categorical_no_override": dataset_eval_categorical_no_override.id,
            "categorical_with_override": dataset_eval_categorical_with_override.id,
            "continuous_no_override": dataset_eval_continuous_no_override.id,
            "continuous_with_override": dataset_eval_continuous_with_override.id,
        }
        yield ids

    async def test_categorical_builtin_without_configs_returns_empty(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that categorical builtin without output configs returns empty list."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on CategoricalAnnotationConfig {
                                name
                                optimizationDirection
                                values { label score }
                            }
                        }
                    }
                }
            }""",
            variables={
                "id": str(
                    GlobalID(DatasetEvaluator.__name__, str(_test_data["categorical_no_override"]))
                )
            },
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "contains_no_override"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list)
        assert len(output_configs) == 0

    async def test_categorical_builtin_with_override(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that categorical builtin with override returns merged config."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        description
                        outputConfigs {
                            __typename
                            ... on CategoricalAnnotationConfig {
                                name
                                description
                                optimizationDirection
                                values { label score }
                            }
                        }
                    }
                }
            }""",
            variables={
                "id": str(
                    GlobalID(
                        DatasetEvaluator.__name__, str(_test_data["categorical_with_override"])
                    )
                )
            },
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "contains_with_override"
        assert node["description"] == "Overridden description"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list) and len(output_configs) >= 1
        output_config = output_configs[0]
        assert output_config["__typename"] == "CategoricalAnnotationConfig"
        assert output_config["name"] == "contains"
        assert output_config["optimizationDirection"] == "MINIMIZE"
        labels = {v["label"] for v in output_config["values"]}
        assert labels == {"yes", "no"}

    async def test_continuous_builtin_without_configs_returns_empty(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that continuous builtin without output configs returns empty list."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on ContinuousAnnotationConfig {
                                name
                                optimizationDirection
                                lowerBound
                                upperBound
                            }
                        }
                    }
                }
            }""",
            variables={
                "id": str(
                    GlobalID(DatasetEvaluator.__name__, str(_test_data["continuous_no_override"]))
                )
            },
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "levenshtein_no_override"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list)
        assert len(output_configs) == 0

    async def test_continuous_builtin_with_override(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that continuous builtin with override returns merged config."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on ContinuousAnnotationConfig {
                                name
                                optimizationDirection
                                lowerBound
                                upperBound
                            }
                        }
                    }
                }
            }""",
            variables={
                "id": str(
                    GlobalID(DatasetEvaluator.__name__, str(_test_data["continuous_with_override"]))
                )
            },
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "levenshtein_with_override"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list) and len(output_configs) >= 1
        output_config = output_configs[0]
        assert output_config["__typename"] == "ContinuousAnnotationConfig"
        assert output_config["name"] == "levenshtein_distance"
        assert output_config["optimizationDirection"] == "MINIMIZE"
        assert output_config["lowerBound"] == 0.1
        assert output_config["upperBound"] == 0.9


class TestBuiltInEvaluatorMultiOutput:
    """Tests for builtin evaluator multi-output (list-based output_configs) support."""

    async def test_builtin_sync_with_list_configs(
        self,
        db: DbSessionFactory,
        synced_builtin_evaluators: None,
    ) -> None:
        """Verify sync mechanism stores output_configs as a list in the database."""
        from sqlalchemy import select

        async with db() as session:
            # Verify all builtin evaluators have output_configs stored as lists
            evaluators = (await session.execute(select(models.BuiltinEvaluator))).scalars().all()
            assert len(evaluators) > 0, "Expected builtin evaluators to be synced"

            for evaluator in evaluators:
                assert evaluator.output_configs is not None
                assert isinstance(evaluator.output_configs, list)
                assert len(evaluator.output_configs) >= 1, (
                    f"Evaluator {evaluator.key} should have at least one output config"
                )
                # Verify each config is a valid annotation config type
                for config in evaluator.output_configs:
                    assert hasattr(config, "type")
                    assert config.type in ("CATEGORICAL", "CONTINUOUS")

    async def test_builtin_graphql_returns_list(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        synced_builtin_evaluators: None,
    ) -> None:
        """Verify GraphQL outputConfigs returns a list for builtin evaluators."""
        from sqlalchemy import select

        from phoenix.server.api.types.Evaluator import BuiltInEvaluator

        # Look up the Contains evaluator (categorical) from the database
        async with db() as session:
            contains_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
            )
            levenshtein_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(
                    models.BuiltinEvaluator.key == "levenshtein_distance"
                )
            )
        assert contains_id is not None
        assert levenshtein_id is not None

        # Test Contains evaluator returns list with categorical config
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on BuiltInEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on CategoricalAnnotationConfig {
                                name
                                optimizationDirection
                                values { label score }
                            }
                            ... on ContinuousAnnotationConfig {
                                name
                                optimizationDirection
                                lowerBound
                                upperBound
                            }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID(BuiltInEvaluator.__name__, str(contains_id)))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "contains"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list)
        assert len(output_configs) >= 1
        assert output_configs[0]["__typename"] == "CategoricalAnnotationConfig"

        # Test LevenshteinDistance evaluator returns list with continuous config
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on BuiltInEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on CategoricalAnnotationConfig {
                                name
                                optimizationDirection
                            }
                            ... on ContinuousAnnotationConfig {
                                name
                                optimizationDirection
                                lowerBound
                                upperBound
                            }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID(BuiltInEvaluator.__name__, str(levenshtein_id)))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "levenshtein_distance"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list)
        assert len(output_configs) >= 1
        assert output_configs[0]["__typename"] == "ContinuousAnnotationConfig"

    async def test_builtin_override_merges_by_name(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        synced_builtin_evaluators: None,
    ) -> None:
        """Verify output_configs are correctly stored for builtin evaluators."""
        from sqlalchemy import select

        async with db() as session:
            # Create dataset
            dataset = models.Dataset(
                name="test-dataset-override-merge",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            # Create project for dataset evaluator
            project = models.Project(name="test-override-project")
            session.add(project)
            await session.flush()

            # Look up Contains evaluator (categorical)
            contains_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
            )
            assert contains_id is not None

            # Look up LevenshteinDistance evaluator (continuous)
            levenshtein_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(
                    models.BuiltinEvaluator.key == "levenshtein_distance"
                )
            )
            assert levenshtein_id is not None

            # Create dataset evaluator with categorical output configs
            categorical_override = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=contains_id,
                name=Identifier("contains_overridden"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[
                    CategoricalOutputConfig(
                        type="CATEGORICAL",
                        name="contains",
                        optimization_direction=OptimizationDirection.MINIMIZE,
                        values=[
                            CategoricalAnnotationValue(label="matched", score=1.0),
                            CategoricalAnnotationValue(label="not_matched", score=0.0),
                        ],
                    )
                ],
                project_id=project.id,
            )
            session.add(categorical_override)
            await session.flush()

            # Create another project for second dataset evaluator
            project2 = models.Project(name="test-override-project-2")
            session.add(project2)
            await session.flush()

            # Create dataset evaluator with continuous output configs
            continuous_override = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=levenshtein_id,
                name=Identifier("levenshtein_overridden"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[
                    ContinuousOutputConfig(
                        type="CONTINUOUS",
                        name="levenshtein_distance",
                        optimization_direction=OptimizationDirection.MAXIMIZE,
                        lower_bound=0.0,
                        upper_bound=100.0,
                    )
                ],
                project_id=project2.id,
            )
            session.add(continuous_override)
            await session.flush()

            categorical_override_id = categorical_override.id
            continuous_override_id = continuous_override.id

        # Verify categorical override was merged by config name
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on CategoricalAnnotationConfig {
                                name
                                optimizationDirection
                                values { label score }
                            }
                        }
                    }
                }
            }""",
            variables={
                "id": str(GlobalID(DatasetEvaluator.__name__, str(categorical_override_id)))
            },
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "contains_overridden"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list)
        assert len(output_configs) >= 1
        config = output_configs[0]
        assert config["__typename"] == "CategoricalAnnotationConfig"
        # The override should have changed optimization direction to MINIMIZE
        assert config["optimizationDirection"] == "MINIMIZE"
        # The override should have changed the values
        labels = {v["label"] for v in config["values"]}
        assert labels == {"matched", "not_matched"}

        # Verify continuous override was merged by config name
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on ContinuousAnnotationConfig {
                                name
                                optimizationDirection
                                lowerBound
                                upperBound
                            }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID(DatasetEvaluator.__name__, str(continuous_override_id)))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "levenshtein_overridden"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list)
        assert len(output_configs) >= 1
        config = output_configs[0]
        assert config["__typename"] == "ContinuousAnnotationConfig"
        # The override should have changed optimization direction to MAXIMIZE
        assert config["optimizationDirection"] == "MAXIMIZE"
        # The override should have changed the bounds
        assert config["lowerBound"] == 0.0
        assert config["upperBound"] == 100.0

    async def test_builtin_empty_output_configs_returns_empty(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        synced_builtin_evaluators: None,
    ) -> None:
        """Verify that empty output_configs returns an empty list."""
        from sqlalchemy import select

        async with db() as session:
            # Create dataset
            dataset = models.Dataset(
                name="test-dataset-no-override",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            # Create project
            project = models.Project(name="test-no-override-project")
            session.add(project)
            await session.flush()

            # Look up Contains evaluator
            contains_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
            )
            assert contains_id is not None

            # Create dataset evaluator with empty output configs
            dataset_eval = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=contains_id,
                name=Identifier("contains_no_override"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[],
                project_id=project.id,
            )
            session.add(dataset_eval)
            await session.flush()
            dataset_eval_id = dataset_eval.id

        # Query the dataset evaluator
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on CategoricalAnnotationConfig {
                                name
                                optimizationDirection
                                values { label score }
                            }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID(DatasetEvaluator.__name__, str(dataset_eval_id)))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list)
        assert len(output_configs) == 0

    async def test_builtin_null_output_configs_falls_back_to_base_evaluator(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        synced_builtin_evaluators: None,
    ) -> None:
        """Verify that null output_configs falls back to the builtin evaluator's configs."""
        async with db() as session:
            dataset = models.Dataset(
                name=f"test-dataset-null-output-configs-{token_hex(4)}",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            project = models.Project(name=f"test-null-output-configs-project-{token_hex(4)}")
            session.add(project)
            await session.flush()

            contains_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
            )
            assert contains_id is not None

            dataset_eval = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=contains_id,
                name=Identifier("contains_null_output_configs"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=None,
                project_id=project.id,
            )
            session.add(dataset_eval)
            await session.flush()
            dataset_eval_id = dataset_eval.id

        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfigs {
                            __typename
                            ... on CategoricalAnnotationConfig {
                                name
                                optimizationDirection
                                values { label score }
                            }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID(DatasetEvaluator.__name__, str(dataset_eval_id)))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["name"] == "contains_null_output_configs"
        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list)
        assert len(output_configs) >= 1
        output_config = output_configs[0]
        assert output_config["__typename"] == "CategoricalAnnotationConfig"
        assert output_config["name"] == "contains"


class TestLLMEvaluatorOutputConfigs:
    """Tests for LLMEvaluator.outputConfigs GraphQL field resolution."""

    @pytest.fixture
    async def _test_data(self, db: DbSessionFactory) -> AsyncIterator[dict[str, Any]]:
        """Create test data: LLM evaluator with multiple output configs."""
        async with db() as session:
            prompt = models.Prompt(name=Identifier(token_hex(4)))
            session.add(prompt)
            await session.flush()

            v1 = _create_prompt_version(prompt.id, "V1: {input}", "gpt-4")
            session.add(v1)
            await session.flush()

            llm_evaluator = models.LLMEvaluator(
                name=Identifier(token_hex(4)),
                prompt_id=prompt.id,
                description="Multi-output LLM evaluator",
                output_configs=[
                    CategoricalOutputConfig(
                        type="CATEGORICAL",
                        name="quality",
                        description="Quality assessment",
                        optimization_direction=OptimizationDirection.MAXIMIZE,
                        values=[
                            CategoricalAnnotationValue(label="high", score=1.0),
                            CategoricalAnnotationValue(label="low", score=0.0),
                        ],
                    ),
                    CategoricalOutputConfig(
                        type="CATEGORICAL",
                        name="relevance",
                        description="Relevance assessment",
                        optimization_direction=OptimizationDirection.MINIMIZE,
                        values=[
                            CategoricalAnnotationValue(label="relevant", score=1.0),
                            CategoricalAnnotationValue(label="irrelevant", score=0.0),
                        ],
                    ),
                ],
            )
            session.add(llm_evaluator)
            await session.flush()

        yield {
            "llm_evaluator": llm_evaluator.id,
        }

    async def test_llm_evaluator_output_configs_returns_all_configs(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Query an LLM evaluator node and verify outputConfigs returns
        the correct list of configs with all fields populated."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on LLMEvaluator {
                        name
                        description
                        outputConfigs {
                            __typename
                            ... on CategoricalAnnotationConfig {
                                name
                                description
                                optimizationDirection
                                values { label score }
                            }
                        }
                    }
                }
            }""",
            variables={
                "id": str(GlobalID(LLMEvaluator.__name__, str(_test_data["llm_evaluator"])))
            },
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["description"] == "Multi-output LLM evaluator"

        output_configs = node["outputConfigs"]
        assert isinstance(output_configs, list)
        assert len(output_configs) == 2

        # Verify first config
        first = output_configs[0]
        assert first["__typename"] == "CategoricalAnnotationConfig"
        assert first["name"] == "quality"
        assert first["description"] == "Quality assessment"
        assert first["optimizationDirection"] == "MAXIMIZE"
        assert len(first["values"]) == 2
        labels_1 = {v["label"] for v in first["values"]}
        assert labels_1 == {"high", "low"}
        scores_1 = {v["label"]: v["score"] for v in first["values"]}
        assert scores_1["high"] == 1.0
        assert scores_1["low"] == 0.0

        # Verify second config
        second = output_configs[1]
        assert second["__typename"] == "CategoricalAnnotationConfig"
        assert second["name"] == "relevance"
        assert second["description"] == "Relevance assessment"
        assert second["optimizationDirection"] == "MINIMIZE"
        assert len(second["values"]) == 2
        labels_2 = {v["label"] for v in second["values"]}
        assert labels_2 == {"relevant", "irrelevant"}
        scores_2 = {v["label"]: v["score"] for v in second["values"]}
        assert scores_2["relevant"] == 1.0
        assert scores_2["irrelevant"] == 0.0


class TestDatasetEvaluatorFields:
    """Tests for DatasetEvaluator field resolution."""

    @pytest.fixture
    async def _test_data(self, db: DbSessionFactory) -> AsyncIterator[dict[str, Any]]:
        """Create test data: dataset evaluators with and without a user."""
        async with db() as session:
            dataset = models.Dataset(
                name=f"test-dataset-{token_hex(4)}",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            prompt = models.Prompt(name=Identifier(token_hex(4)))
            session.add(prompt)
            await session.flush()

            prompt_version = _create_prompt_version(prompt.id, "Test: {input}", "gpt-4")
            session.add(prompt_version)
            await session.flush()

            llm_evaluator = models.LLMEvaluator(
                name=Identifier(token_hex(4)),
                prompt_id=prompt.id,
            )
            session.add(llm_evaluator)
            await session.flush()

            user_role = models.UserRole(name="MEMBER")
            session.add(user_role)
            await session.flush()

            user = models.User(
                user_role_id=user_role.id,
                username=f"test-user-{token_hex(4)}",
                email=f"{token_hex(4)}@test.com",
                password_hash=b"hash",
                password_salt=b"salt",
                reset_password=False,
                auth_method="LOCAL",
            )
            session.add(user)
            await session.flush()

            de_with_user = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=llm_evaluator.id,
                name=Identifier("eval_with_user"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                user_id=user.id,
                project=models.Project(name=f"{dataset.name}/eval_with_user"),
            )
            session.add(de_with_user)
            await session.flush()

            de_without_user = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=llm_evaluator.id,
                name=Identifier("eval_without_user"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name=f"{dataset.name}/eval_without_user"),
            )
            session.add(de_without_user)
            await session.flush()

        yield {
            "dataset": dataset.id,
            "user": user.id,
            "de_with_user": de_with_user.id,
            "de_without_user": de_without_user.id,
        }

    async def test_dataset_evaluator_resolves_dataset(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that DatasetEvaluator.dataset returns the associated dataset."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator { dataset { id } }
                }
            }""",
            variables={
                "id": str(GlobalID(DatasetEvaluator.__name__, str(_test_data["de_with_user"])))
            },
        )
        assert not resp.errors and resp.data
        expected_dataset_id = str(GlobalID("Dataset", str(_test_data["dataset"])))
        assert resp.data["node"]["dataset"]["id"] == expected_dataset_id

    async def test_dataset_evaluator_resolves_user_when_present(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that DatasetEvaluator.user returns the user when user_id is set."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator { user { id } }
                }
            }""",
            variables={
                "id": str(GlobalID(DatasetEvaluator.__name__, str(_test_data["de_with_user"])))
            },
        )
        assert not resp.errors and resp.data
        expected_user_id = str(GlobalID("User", str(_test_data["user"])))
        assert resp.data["node"]["user"]["id"] == expected_user_id

    async def test_dataset_evaluator_returns_null_user_when_not_set(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that DatasetEvaluator.user returns null when user_id is not set."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator { user { id } }
                }
            }""",
            variables={
                "id": str(GlobalID(DatasetEvaluator.__name__, str(_test_data["de_without_user"])))
            },
        )
        assert not resp.errors and resp.data
        assert resp.data["node"]["user"] is None


class TestCodeEvaluatorVersionGraphQLTraversal:
    async def test_currentVersion_versions_sequence_previous(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        import sqlalchemy as sa

        from phoenix.server.sandbox.sync import sync_languages

        async with db() as session:
            await sync_languages(session)
            language_row = await session.scalar(
                sa.select(models.Language).where(models.Language.name == "PYTHON")
            )
            assert language_row is not None

            evaluator_row = models.CodeEvaluator(
                name=Identifier(root=f"traverse-{token_hex(4)}"),
                description="traversal test",
                metadata_={},
                language="PYTHON",
            )
            session.add(evaluator_row)
            await session.flush()

            v1 = models.CodeEvaluatorVersion(
                code_evaluator_id=evaluator_row.id,
                source_code="def evaluate(input): return {'score': 0.0}",
            )
            session.add(v1)
            await session.flush()
            v2 = models.CodeEvaluatorVersion(
                code_evaluator_id=evaluator_row.id,
                source_code="def evaluate(input): return {'score': 1.0}",
            )
            session.add(v2)
            await session.flush()
            evaluator_id = evaluator_row.id
            v1_gid = str(GlobalID("CodeEvaluatorVersion", str(v1.id)))
            v2_gid = str(GlobalID("CodeEvaluatorVersion", str(v2.id)))

        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_id)))
        resp = await gql_client.execute(
            """
            query ($id: ID!, $versionId: ID!) {
                node(id: $id) {
                    ... on CodeEvaluator {
                        sourceCode
                        inputSchema
                        currentVersion {
                            id
                            sequenceNumber
                            previousVersion { id }
                        }
                        versions(first: 10) {
                            edges { node { id sequenceNumber } }
                        }
                        version(versionId: $versionId) {
                            id
                            sequenceNumber
                        }
                    }
                }
            }
            """,
            variables={"id": evaluator_gid, "versionId": v1_gid},
        )
        assert not resp.errors and resp.data is not None
        ce = resp.data["node"]
        assert ce["sourceCode"] == "def evaluate(input): return {'score': 1.0}"
        assert set(ce["inputSchema"]["properties"]) == {"input"}
        cv = ce["currentVersion"]
        assert cv["id"] == v2_gid
        assert cv["sequenceNumber"] == 2
        assert cv["previousVersion"]["id"] == v1_gid

        version_node_ids = [edge["node"]["id"] for edge in ce["versions"]["edges"]]
        assert version_node_ids == [v2_gid, v1_gid]

        looked_up = ce["version"]
        assert looked_up["id"] == v1_gid
        assert looked_up["sequenceNumber"] == 1


class TestCodeEvaluatorOutputConfigs:
    """Stored code-evaluator output configs must survive the GraphQL read path.

    Stored configs deserialize as base annotation-config models, so a naive
    isinstance filter against the OutputConfig subclasses silently drops every
    config (regression: the resolver returned [] and the frontend lost
    coloring metadata for attached code evaluators).
    """

    async def test_stored_output_configs_resolve_over_graphql(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        from phoenix.server.sandbox.sync import sync_languages

        async with db() as session:
            await sync_languages(session)
            evaluator_row = models.CodeEvaluator(
                name=Identifier(root=f"output-configs-{token_hex(4)}"),
                metadata_={},
                language="PYTHON",
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[
                    ContinuousOutputConfig(
                        type="CONTINUOUS",
                        name="score",
                        optimization_direction=OptimizationDirection.MAXIMIZE,
                        description=None,
                        lower_bound=0.0,
                        upper_bound=1.0,
                    ),
                    CategoricalOutputConfig(
                        type="CATEGORICAL",
                        name="verdict",
                        optimization_direction=OptimizationDirection.MINIMIZE,
                        description=None,
                        values=[
                            CategoricalAnnotationValue(label="good", score=1.0),
                            CategoricalAnnotationValue(label="bad", score=0.0),
                        ],
                    ),
                ],
            )
            session.add(evaluator_row)
            await session.flush()
            evaluator_id = evaluator_row.id

        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on CodeEvaluator {
                        outputConfigs {
                            __typename
                            ... on ContinuousAnnotationConfig {
                                name
                                optimizationDirection
                                lowerBound
                                upperBound
                            }
                            ... on CategoricalAnnotationConfig {
                                name
                                optimizationDirection
                                values { label score }
                            }
                        }
                    }
                }
            }""",
            variables={"id": str(GlobalID("CodeEvaluator", str(evaluator_id)))},
        )
        assert not resp.errors and resp.data
        output_configs = resp.data["node"]["outputConfigs"]
        assert len(output_configs) == 2
        continuous, categorical = output_configs
        assert continuous["__typename"] == "ContinuousAnnotationConfig"
        assert continuous["name"] == "score"
        assert continuous["optimizationDirection"] == "MAXIMIZE"
        assert continuous["lowerBound"] == 0.0
        assert continuous["upperBound"] == 1.0
        assert categorical["__typename"] == "CategoricalAnnotationConfig"
        assert categorical["name"] == "verdict"
        assert categorical["optimizationDirection"] == "MINIMIZE"
        assert {v["label"] for v in categorical["values"]} == {"good", "bad"}


async def test_project_evaluator_run_summary(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    now = datetime.now(timezone.utc)
    fingerprint = token_hex(8)
    async with db() as session:
        project = models.Project(name=f"project-{token_hex(4)}")
        evaluator = models.BuiltinEvaluator(
            name=Identifier(f"evaluator-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add_all([project, evaluator])
        await session.flush()
        project_evaluator = models.ProjectEvaluator(
            trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(f"project-evaluator-name-{token_hex(4)}"),
            evaluation_target="SPAN",
            filter_condition="",
            sampling_rate=1.0,
        )
        trace = models.Trace(
            trace_id=token_hex(8),
            project_rowid=project.id,
            start_time=now,
            end_time=now,
        )
        project_session = models.ProjectSession(
            session_id=token_hex(8),
            project_id=project.id,
            start_time=now,
            end_time=now,
        )
        session.add_all([project_evaluator, trace, project_session])
        await session.flush()
        spans = [
            models.Span(
                trace_rowid=trace.id,
                span_id=token_hex(8),
                name=f"span-{index}",
                span_kind="LLM",
                start_time=now,
                end_time=now,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            for index in range(6)
        ]
        session.add_all(spans)
        await session.flush()
        session.add_all(
            [
                models.EvalWorkUnit(
                    span_rowid=spans[0].id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=fingerprint,
                    status="DONE",
                    updated_at=now - timedelta(minutes=1),
                ),
                models.EvalWorkUnit(
                    span_rowid=spans[1].id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=fingerprint,
                    status="ERROR",
                    attempts=MAX_ATTEMPTS,
                    error="rate limited",
                    updated_at=now - timedelta(minutes=10),
                ),
                models.EvalWorkUnit(
                    span_rowid=spans[2].id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=fingerprint,
                    status="PENDING",
                    updated_at=now,
                ),
                models.EvalWorkUnit(
                    span_rowid=spans[3].id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=fingerprint,
                    status="EXPIRED",
                    error=STALE_FINGERPRINT_ERROR,
                    updated_at=now,
                ),
                # An error with attempts remaining is a retry in progress, not a
                # failure — it must count as queued and must not surface its error.
                models.EvalWorkUnit(
                    span_rowid=spans[4].id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=fingerprint,
                    status="ERROR",
                    attempts=1,
                    error="retrying rate limit",
                    updated_at=now,
                ),
                # A non-stale expiry was given up on — it counts as failed and,
                # being the newest failure, owns lastError.
                models.EvalWorkUnit(
                    span_rowid=spans[5].id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=fingerprint,
                    status="EXPIRED",
                    error="execution deadline exceeded",
                    updated_at=now - timedelta(minutes=5),
                ),
                models.EvalSessionWorkUnit(
                    project_session_rowid=project_session.id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=fingerprint,
                    evaluated_through=now,
                    status="DONE",
                    updated_at=now - timedelta(minutes=2),
                ),
                # Expired because the session's traces were deleted before the
                # evaluation ran — a lifecycle event outside every bucket.
                models.EvalSessionWorkUnit(
                    project_session_rowid=project_session.id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=token_hex(8),
                    evaluated_through=now,
                    status="EXPIRED",
                    error=SESSION_CONTENT_INCOMPLETE_ERROR,
                    updated_at=now,
                ),
            ]
        )
        await session.flush()
        project_evaluator_id = project_evaluator.id

    response = await gql_client.execute(
        """query ($id: ID!) {
            node(id: $id) {
                ... on ProjectEvaluator {
                    runSummary {
                        status
                        lastRunAt
                        queuedCount
                        evaluatedCount
                        failedCount
                        lastError
                    }
                }
            }
        }""",
        variables={"id": str(GlobalID("ProjectEvaluator", str(project_evaluator_id)))},
    )

    assert not response.errors and response.data
    run_summary = response.data["node"]["runSummary"]
    assert run_summary["status"] == "HEALTHY"
    assert run_summary["evaluatedCount"] == 2
    # Given up on: the ERROR at MAX_ATTEMPTS and the non-stale EXPIRED. The
    # stale-fingerprint and content-incomplete expiries fall outside every bucket.
    assert run_summary["failedCount"] == 2
    # Waiting: the PENDING unit and the ERROR with attempts remaining.
    assert run_summary["queuedCount"] == 2
    # The newest FAILED unit's error — not the retrying unit's, which is newer but
    # not a failure, and not a lifecycle expiry's.
    assert run_summary["lastError"] == "execution deadline exceeded"
    assert datetime.fromisoformat(run_summary["lastRunAt"]) == now - timedelta(minutes=1)


async def test_project_evaluator_run_summary_reports_failing_when_failure_is_newest(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """Failure newer than the last success wins the status — the direction that
    matters for an evaluator that used to work and no longer does."""
    now = datetime.now(timezone.utc)
    fingerprint = token_hex(8)
    async with db() as session:
        project = models.Project(name=f"project-{token_hex(4)}")
        evaluator = models.BuiltinEvaluator(
            name=Identifier(f"evaluator-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add_all([project, evaluator])
        await session.flush()
        project_evaluator = models.ProjectEvaluator(
            trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(f"project-evaluator-name-{token_hex(4)}"),
            evaluation_target="SPAN",
            filter_condition="",
            sampling_rate=1.0,
        )
        trace = models.Trace(
            trace_id=token_hex(8),
            project_rowid=project.id,
            start_time=now,
            end_time=now,
        )
        session.add_all([project_evaluator, trace])
        await session.flush()
        spans = [
            models.Span(
                trace_rowid=trace.id,
                span_id=token_hex(8),
                name=f"span-{index}",
                span_kind="LLM",
                start_time=now,
                end_time=now,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            for index in range(2)
        ]
        session.add_all(spans)
        await session.flush()
        session.add_all(
            [
                models.EvalWorkUnit(
                    span_rowid=spans[0].id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=fingerprint,
                    status="DONE",
                    updated_at=now - timedelta(minutes=10),
                ),
                models.EvalWorkUnit(
                    span_rowid=spans[1].id,
                    evaluator_id=evaluator.id,
                    project_evaluator_id=project_evaluator.id,
                    config_fingerprint=fingerprint,
                    status="ERROR",
                    attempts=MAX_ATTEMPTS,
                    error="credentials expired",
                    updated_at=now - timedelta(minutes=1),
                ),
            ]
        )
        await session.flush()
        project_evaluator_id = project_evaluator.id

    response = await gql_client.execute(
        """query ($id: ID!) {
            node(id: $id) {
                ... on ProjectEvaluator {
                    runSummary { status lastError }
                }
            }
        }""",
        variables={"id": str(GlobalID("ProjectEvaluator", str(project_evaluator_id)))},
    )

    assert not response.errors and response.data
    run_summary = response.data["node"]["runSummary"]
    assert run_summary["status"] == "FAILING"
    assert run_summary["lastError"] == "credentials expired"


async def test_project_evaluator_trace_project_resolves_to_its_dedicated_project(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    async with db() as session:
        project = models.Project(name=f"project-{token_hex(4)}")
        evaluator = models.BuiltinEvaluator(
            name=Identifier(f"evaluator-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add_all([project, evaluator])
        await session.flush()
        trace_project = models.Project(name=f"project-evaluator-{token_hex(12)}")
        project_evaluator = models.ProjectEvaluator(
            trace_project=trace_project,
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(f"project-evaluator-name-{token_hex(4)}"),
            evaluation_target="SPAN",
            filter_condition="",
            sampling_rate=1.0,
        )
        session.add(project_evaluator)
        await session.flush()
        project_evaluator_id = project_evaluator.id
        trace_project_id = trace_project.id
        trace_project_name = trace_project.name

    response = await gql_client.execute(
        """query ($id: ID!) {
            node(id: $id) {
                ... on ProjectEvaluator {
                    traceProject { id name }
                }
            }
        }""",
        variables={"id": str(GlobalID("ProjectEvaluator", str(project_evaluator_id)))},
    )

    assert not response.errors and response.data
    resolved = response.data["node"]["traceProject"]
    assert resolved["id"] == str(GlobalID("Project", str(trace_project_id)))
    assert resolved["name"] == trace_project_name


async def test_project_evaluator_trace_project_spans_are_scoped_to_the_evaluator(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    now = datetime.now(timezone.utc)
    async with db() as session:
        project = models.Project(name=f"project-{token_hex(4)}")
        evaluator = models.BuiltinEvaluator(
            name=Identifier(f"evaluator-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add_all([project, evaluator])
        await session.flush()
        project_evaluator = [
            models.ProjectEvaluator(
                trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
                project_id=project.id,
                evaluator_id=evaluator.id,
                name=Identifier(f"project-evaluator-name-{token_hex(4)}"),
                evaluation_target="SPAN",
                filter_condition="",
                sampling_rate=1.0,
            )
            for _ in range(2)
        ]
        session.add_all(project_evaluator)
        await session.flush()
        project_evaluator_ids = [c.id for c in project_evaluator]
        # Both spans land in the first evaluator's trace project, so the scope has a foreign span.
        trace = models.Trace(
            trace_id=token_hex(8),
            project_rowid=project_evaluator[0].trace_project_id,
            start_time=now,
            end_time=now,
        )
        session.add(trace)
        await session.flush()
        for c in project_evaluator:
            session.add(
                models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=None,
                    name=f"Evaluator: {c.id}",
                    span_kind="EVALUATOR",
                    start_time=now,
                    end_time=now,
                    attributes={
                        "phoenix": {
                            "evaluator_trace": True,
                            "project_evaluator_id": str(GlobalID("ProjectEvaluator", str(c.id))),
                        }
                    },
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )
        await session.flush()

    response = await gql_client.execute(
        """query ($id: ID!) {
            node(id: $id) {
                ... on ProjectEvaluator {
                    traceProject {
                        spans(first: 10, projectEvaluatorId: $id) {
                            edges { node { name } }
                        }
                    }
                }
            }
        }""",
        variables={"id": str(GlobalID("ProjectEvaluator", str(project_evaluator_ids[0])))},
    )

    assert not response.errors and response.data
    trace_project = response.data["node"]["traceProject"]
    assert [edge["node"]["name"] for edge in trace_project["spans"]["edges"]] == [
        f"Evaluator: {project_evaluator_ids[0]}"
    ]
