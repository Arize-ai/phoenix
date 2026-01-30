from secrets import token_hex
from typing import Any, AsyncIterator

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.api.types.Evaluator import DatasetEvaluator, LLMEvaluator
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
        """Create test data: prompt with 2 versions, 1 tag pointing to v1, and 2 evaluators."""
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

        ids = {
            "prompt": prompt.id,
            "v1": v1.id,
            "v2": v2.id,
            "tag": tag.id,
            "untagged": untagged.id,
            "tagged": tagged.id,
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
                output_config=CategoricalAnnotationConfig(
                    type="CATEGORICAL",
                    name="result",
                    optimization_direction=OptimizationDirection.MINIMIZE,
                    values=[
                        CategoricalAnnotationValue(label="good", score=1.0),
                        CategoricalAnnotationValue(label="bad", score=0.0),
                    ],
                ),
            )
            session.add(llm_evaluator)
            await session.flush()

            dataset_evaluator_with_desc = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=llm_evaluator.id,
                name=Identifier("eval_with_desc"),
                description="Dataset evaluator override description",
                input_mapping={"literal_mapping": {}, "path_mapping": {}},
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
                input_mapping={"literal_mapping": {}, "path_mapping": {}},
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
                output_config=CategoricalAnnotationConfig(
                    type="CATEGORICAL",
                    name="result2",
                    optimization_direction=OptimizationDirection.MINIMIZE,
                    values=[
                        CategoricalAnnotationValue(label="good", score=1.0),
                        CategoricalAnnotationValue(label="bad", score=0.0),
                    ],
                ),
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
                input_mapping={"literal_mapping": {}, "path_mapping": {}},
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
    """Tests for BuiltInEvaluator.output_config field resolution."""

    async def test_categorical_builtin_returns_categorical_output_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        synced_builtin_evaluators: None,
    ) -> None:
        """Test that Contains evaluator returns a CategoricalAnnotationConfig."""
        from sqlalchemy import select

        from phoenix.server.api.types.Evaluator import BuiltInEvaluator

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
                        outputConfig {
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
        assert node["name"] == "Contains"
        output_config = node["outputConfig"]
        assert output_config["__typename"] == "CategoricalAnnotationConfig"
        assert output_config["name"] == "Contains"
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
        """Test that LevenshteinDistance evaluator returns a ContinuousAnnotationConfig."""
        from sqlalchemy import select

        from phoenix.server.api.types.Evaluator import BuiltInEvaluator

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
                        outputConfig {
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
        assert node["name"] == "LevenshteinDistance"
        output_config = node["outputConfig"]
        assert output_config["__typename"] == "ContinuousAnnotationConfig"
        assert output_config["name"] == "LevenshteinDistance"
        assert output_config["optimizationDirection"] == "MINIMIZE"
        assert output_config["lowerBound"] == 0.0
        assert output_config["upperBound"] is None


class TestDatasetEvaluatorBuiltinOutputConfig:
    """Tests for DatasetEvaluator.output_config with builtin evaluators."""

    @pytest.fixture
    async def _test_data(
        self, db: DbSessionFactory, synced_builtin_evaluators: None
    ) -> AsyncIterator[dict[str, Any]]:
        """Create test data: dataset with builtin evaluator assignments."""
        from sqlalchemy import select

        from phoenix.db.types.annotation_configs import (
            CategoricalAnnotationConfigOverride,
            ContinuousAnnotationConfigOverride,
        )

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
                input_mapping={"literal_mapping": {}, "path_mapping": {}},
                project_id=project.id,
            )
            session.add(dataset_eval_categorical_no_override)
            await session.flush()

            dataset_eval_categorical_with_override = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=contains_evaluator_id,
                name=Identifier("contains_with_override"),
                input_mapping={"literal_mapping": {}, "path_mapping": {}},
                output_config_override=CategoricalAnnotationConfigOverride(
                    type="CATEGORICAL",
                    optimization_direction=OptimizationDirection.MINIMIZE,
                    values=[
                        CategoricalAnnotationValue(label="yes", score=1.0),
                        CategoricalAnnotationValue(label="no", score=0.0),
                    ],
                ),
                description="Overridden description",
                project_id=project.id,
            )
            session.add(dataset_eval_categorical_with_override)
            await session.flush()

            dataset_eval_continuous_no_override = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=levenshtein_evaluator_id,
                name=Identifier("levenshtein_no_override"),
                input_mapping={"literal_mapping": {}, "path_mapping": {}},
                project_id=project.id,
            )
            session.add(dataset_eval_continuous_no_override)
            await session.flush()

            dataset_eval_continuous_with_override = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=levenshtein_evaluator_id,
                name=Identifier("levenshtein_with_override"),
                input_mapping={"literal_mapping": {}, "path_mapping": {}},
                output_config_override=ContinuousAnnotationConfigOverride(
                    type="CONTINUOUS",
                    optimization_direction=OptimizationDirection.MINIMIZE,
                    lower_bound=0.1,
                    upper_bound=0.9,
                ),
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

    async def test_categorical_builtin_without_override(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that categorical builtin without override returns base config."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfig {
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
        output_config = node["outputConfig"]
        assert output_config["__typename"] == "CategoricalAnnotationConfig"
        assert output_config["name"] == "contains_no_override"
        assert output_config["optimizationDirection"] == "MAXIMIZE"
        labels = {v["label"] for v in output_config["values"]}
        assert labels == {"true", "false"}

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
                        outputConfig {
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
        output_config = node["outputConfig"]
        assert output_config["__typename"] == "CategoricalAnnotationConfig"
        assert output_config["name"] == "contains_with_override"
        assert output_config["description"] == "Overridden description"
        assert output_config["optimizationDirection"] == "MINIMIZE"
        labels = {v["label"] for v in output_config["values"]}
        assert labels == {"yes", "no"}

    async def test_continuous_builtin_without_override(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that continuous builtin without override returns base config."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfig {
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
        output_config = node["outputConfig"]
        assert output_config["__typename"] == "ContinuousAnnotationConfig"
        assert output_config["name"] == "levenshtein_no_override"
        assert output_config["optimizationDirection"] == "MINIMIZE"
        assert output_config["lowerBound"] == 0.0
        assert output_config["upperBound"] is None

    async def test_continuous_builtin_with_override(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that continuous builtin with override returns merged config."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        name
                        outputConfig {
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
        output_config = node["outputConfig"]
        assert output_config["__typename"] == "ContinuousAnnotationConfig"
        assert output_config["name"] == "levenshtein_with_override"
        assert output_config["optimizationDirection"] == "MINIMIZE"
        assert output_config["lowerBound"] == 0.1
        assert output_config["upperBound"] == 0.9

    async def test_dataset_evaluator_and_underlying_evaluator_output_config_have_different_ids(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test that DatasetEvaluator.outputConfig and DatasetEvaluator.evaluator.outputConfig
        have distinct IDs even when referencing the same underlying evaluator.
        This ensures Relay can properly cache and differentiate these objects."""
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on DatasetEvaluator {
                        outputConfig {
                            ... on CategoricalAnnotationConfig { id }
                        }
                        evaluator {
                            ... on BuiltInEvaluator {
                                outputConfig {
                                    ... on CategoricalAnnotationConfig { id }
                                }
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
        dataset_evaluator_output_config_id = node["outputConfig"]["id"]
        underlying_evaluator_output_config_id = node["evaluator"]["outputConfig"]["id"]
        # These should be different IDs to avoid Relay cache collisions
        assert dataset_evaluator_output_config_id != underlying_evaluator_output_config_id
