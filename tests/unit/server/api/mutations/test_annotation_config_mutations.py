from copy import deepcopy
from typing import Any

import pytest
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.db.types.annotation_configs import AnnotationType
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def project(db: DbSessionFactory) -> models.Project:
    """Inserts a project into the database."""
    async with db() as session:
        project = models.Project(
            name=DEFAULT_PROJECT_NAME,
        )
        session.add(project)
        await session.flush()
    return project


class TestAnnotationConfigMutations:
    QUERY = """
    mutation CreateAnnotationConfig($input: CreateAnnotationConfigInput!) {
        createAnnotationConfig(input: $input) {
            annotationConfig {
                ... on CategoricalAnnotationConfig {
                    ...CategoricalAnnotationConfigFields
                }
                ... on ContinuousAnnotationConfig {
                    ...ContinuousAnnotationConfigFields
                }
                ... on FreeformAnnotationConfig {
                    ...FreeformAnnotationConfigFields
                }
            }
        }
    }

    mutation UpdateAnnotationConfig($input: UpdateAnnotationConfigInput!) {
        updateAnnotationConfig(input: $input) {
            annotationConfig {
                ... on CategoricalAnnotationConfig {
                    ...CategoricalAnnotationConfigFields
                }
                ... on ContinuousAnnotationConfig {
                    ...ContinuousAnnotationConfigFields
                }
                ... on FreeformAnnotationConfig {
                    ...FreeformAnnotationConfigFields
                }
            }
        }
    }

    query ListAnnotationConfigs {
        annotationConfigs(first: 10) {
            edges {
                node {
                    ... on CategoricalAnnotationConfig {
                        ...CategoricalAnnotationConfigFields
                    }
                    ... on ContinuousAnnotationConfig {
                        ...ContinuousAnnotationConfigFields
                    }
                    ... on FreeformAnnotationConfig {
                        ...FreeformAnnotationConfigFields
                    }
                }
            }
        }
    }

    mutation DeleteAnnotationConfigs($input: DeleteAnnotationConfigsInput!) {
        deleteAnnotationConfigs(input: $input) {
            annotationConfigs {
                ... on CategoricalAnnotationConfig {
                    ...CategoricalAnnotationConfigFields
                }
                ... on ContinuousAnnotationConfig {
                    ...ContinuousAnnotationConfigFields
                }
                ... on FreeformAnnotationConfig {
                    ...FreeformAnnotationConfigFields
                }
            }
        }
    }

    mutation AddAnnotationConfigToProject($input: [AddAnnotationConfigToProjectInput!]!) {
        addAnnotationConfigToProject(input: $input) {
            project {
                annotationConfigs {
                    edges {
                        node {
                            ... on CategoricalAnnotationConfig {
                                ...CategoricalAnnotationConfigFields
                            }
                            ... on ContinuousAnnotationConfig {
                                ...ContinuousAnnotationConfigFields
                            }
                            ... on FreeformAnnotationConfig {
                                ...FreeformAnnotationConfigFields
                            }
                        }
                    }
                }
            }
        }
    }

    mutation RemoveAnnotationConfigFromProject($input: [RemoveAnnotationConfigFromProjectInput!]!) {
        removeAnnotationConfigFromProject(input: $input) {
            project {
                annotationConfigs {
                    edges {
                        node {
                            ... on CategoricalAnnotationConfig {
                                ...CategoricalAnnotationConfigFields
                            }
                            ... on ContinuousAnnotationConfig {
                                ...ContinuousAnnotationConfigFields
                            }
                            ... on FreeformAnnotationConfig {
                                ...FreeformAnnotationConfigFields
                            }
                        }
                    }
                }
            }
        }
    }

    fragment CategoricalAnnotationConfigFields on CategoricalAnnotationConfig {
        id
        name
        annotationType
        optimizationDirection
        description
        values {
            label
            score
        }
    }

    fragment ContinuousAnnotationConfigFields on ContinuousAnnotationConfig {
        id
        name
        annotationType
        optimizationDirection
        description
        lowerBound
        upperBound
    }

    fragment FreeformAnnotationConfigFields on FreeformAnnotationConfig {
        id
        name
        annotationType
        description
    }
    """

    @pytest.mark.parametrize(
        "create_config,update_config,annotation_type",
        [
            pytest.param(
                {
                    "name": "Test Categorical Config",
                    "description": "Test description",
                    "optimizationDirection": "MAXIMIZE",
                    "values": [
                        {"label": "Good", "score": 1.0},
                        {"label": "Bad", "score": 0.0},
                    ],
                },
                {
                    "name": "Updated Categorical Config",
                    "description": "Updated description",
                    "optimizationDirection": "MINIMIZE",
                    "values": [
                        {"label": "Excellent", "score": 1.0},
                        {"label": "Poor", "score": 0.0},
                    ],
                },
                AnnotationType.CATEGORICAL.value,
                id="categorical",
            ),
            pytest.param(
                {
                    "name": "Test Continuous Config",
                    "description": "Test description",
                    "optimizationDirection": "MAXIMIZE",
                    "lowerBound": 0.0,
                    "upperBound": 1.0,
                },
                {
                    "name": "Updated Continuous Config",
                    "description": "Updated description",
                    "optimizationDirection": "MINIMIZE",
                    "lowerBound": -1.0,
                    "upperBound": 2.0,
                },
                AnnotationType.CONTINUOUS.value,
                id="continuous",
            ),
            pytest.param(
                {
                    "name": "Test Freeform Config",
                    "description": "Test description",
                },
                {
                    "name": "Updated Freeform Config",
                    "description": "Updated description",
                },
                AnnotationType.FREEFORM.value,
                id="freeform",
            ),
        ],
    )
    async def test_annotation_config_crud_operations(
        self,
        gql_client: AsyncGraphQLClient,
        project: models.Project,
        create_config: dict[str, Any],
        update_config: dict[str, Any],
        annotation_type: str,
    ) -> None:
        # Create a categorical annotation config
        annotation_type_key = annotation_type.lower()
        create_response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "annotationConfig": {
                        annotation_type_key: create_config,
                    }
                }
            },
            operation_name="CreateAnnotationConfig",
        )
        assert not create_response.errors
        assert (data := create_response.data) is not None
        created_config = data["createAnnotationConfig"]["annotationConfig"]
        config_id = created_config["id"]
        expected_config = deepcopy(create_config)
        expected_config["id"] = config_id
        expected_config["annotationType"] = annotation_type
        assert created_config == expected_config

        # List annotation configs
        list_response = await gql_client.execute(
            query=self.QUERY,
            operation_name="ListAnnotationConfigs",
        )
        assert not list_response.errors
        assert (data := list_response.data) is not None
        configs = data["annotationConfigs"]["edges"]
        assert len(configs) == 1
        assert configs[0]["node"] == created_config

        # Update the annotation config
        update_response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": config_id,
                    "annotationConfig": {
                        annotation_type_key: update_config,
                    },
                }
            },
            operation_name="UpdateAnnotationConfig",
        )
        assert not update_response.errors
        assert (data := update_response.data) is not None
        updated_config = data["updateAnnotationConfig"]["annotationConfig"]
        expected_config = deepcopy(update_config)
        expected_config["id"] = config_id
        expected_config["annotationType"] = annotation_type
        assert updated_config == expected_config

        # Add annotation config to project
        project_id = str(GlobalID("Project", str(project.id)))
        add_response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": [
                    {
                        "projectId": project_id,
                        "annotationConfigId": config_id,
                    }
                ]
            },
            operation_name="AddAnnotationConfigToProject",
        )
        assert not add_response.errors
        assert (data := add_response.data) is not None
        project_configs = data["addAnnotationConfigToProject"]["project"]["annotationConfigs"][
            "edges"
        ]
        assert len(project_configs) == 1
        assert project_configs[0]["node"] == expected_config

        # Remove annotation config from project
        remove_response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": [
                    {
                        "projectId": project_id,
                        "annotationConfigId": config_id,
                    }
                ]
            },
            operation_name="RemoveAnnotationConfigFromProject",
        )
        assert not remove_response.errors
        assert (data := remove_response.data) is not None
        project_configs = data["removeAnnotationConfigFromProject"]["project"]["annotationConfigs"][
            "edges"
        ]
        assert len(project_configs) == 0

        # Delete the annotation config
        delete_response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "ids": [config_id],
                }
            },
            operation_name="DeleteAnnotationConfigs",
        )
        assert not delete_response.errors
        assert (data := delete_response.data) is not None
        deleted_configs = data["deleteAnnotationConfigs"]["annotationConfigs"]
        assert len(deleted_configs) == 1
        assert deleted_configs[0] == expected_config

        # Verify the config is deleted by listing
        list_response = await gql_client.execute(
            query=self.QUERY,
            operation_name="ListAnnotationConfigs",
        )
        assert not list_response.errors
        assert (data := list_response.data) is not None
        configs = data["annotationConfigs"]["edges"]
        assert len(configs) == 0

    @pytest.mark.parametrize(
        "config,annotation_type",
        [
            pytest.param(
                {
                    "name": "note",
                    "description": "Test description",
                    "optimizationDirection": "MAXIMIZE",
                    "values": [
                        {"label": "Good", "score": 1.0},
                        {"label": "Bad", "score": 0.0},
                    ],
                },
                AnnotationType.CATEGORICAL.value,
                id="categorical",
            ),
            pytest.param(
                {
                    "name": "note",
                    "description": "Test description",
                    "optimizationDirection": "MAXIMIZE",
                    "lowerBound": 0.0,
                    "upperBound": 1.0,
                },
                AnnotationType.CONTINUOUS.value,
                id="continuous",
            ),
            pytest.param(
                {
                    "name": "note",
                    "description": "Test description",
                },
                AnnotationType.FREEFORM.value,
                id="freeform",
            ),
        ],
    )
    async def test_cannot_create_annotation_config_with_reserved_name_for_notes(
        self,
        gql_client: AsyncGraphQLClient,
        config: dict[str, Any],
        annotation_type: str,
    ) -> None:
        annotation_type_key = annotation_type.lower()
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "annotationConfig": {
                        annotation_type_key: config,
                    }
                }
            },
            operation_name="CreateAnnotationConfig",
        )
        assert response.data is None
        assert response.errors
        assert len(response.errors) == 1
        error = response.errors[0]
        assert "The name 'note' is reserved for span notes" in error.message

    @pytest.mark.parametrize(
        ("update_config", "annotation_type"),
        [
            pytest.param(
                {
                    "name": "note",
                    "description": "Test description",
                    "optimizationDirection": "MAXIMIZE",
                    "values": [
                        {"label": "Good", "score": 1.0},
                        {"label": "Bad", "score": 0.0},
                    ],
                },
                AnnotationType.CATEGORICAL.value,
                id="categorical",
            ),
            pytest.param(
                {
                    "name": "note",
                    "description": "Test description",
                    "optimizationDirection": "MAXIMIZE",
                    "lowerBound": 0.0,
                    "upperBound": 1.0,
                },
                AnnotationType.CONTINUOUS.value,
                id="continuous",
            ),
            pytest.param(
                {
                    "name": "note",
                    "description": "Test description",
                },
                AnnotationType.FREEFORM.value,
                id="freeform",
            ),
        ],
    )
    async def test_cannot_update_annotation_config_with_reserved_name_for_notes(
        self,
        gql_client: AsyncGraphQLClient,
        update_config: dict[str, Any],
        annotation_type: str,
    ) -> None:
        annotation_type_key = annotation_type.lower()
        create_response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "annotationConfig": {
                        "freeform": {
                            "name": "config-name",
                            "description": "config-description",
                        },
                    }
                }
            },
            operation_name="CreateAnnotationConfig",
        )
        assert create_response.data is not None
        assert not create_response.errors
        created_config = create_response.data["createAnnotationConfig"]["annotationConfig"]
        config_id = created_config["id"]

        # Try to update with reserved name
        update_response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": config_id,
                    "annotationConfig": {
                        annotation_type_key: update_config,
                    },
                }
            },
            operation_name="UpdateAnnotationConfig",
        )
        assert update_response.data is None
        assert update_response.errors
        assert len(update_response.errors) == 1
        error = update_response.errors[0]
        assert "The name 'note' is reserved for span notes" in error.message

    @pytest.mark.parametrize(
        ("annotation_type", "config"),
        [
            pytest.param(
                AnnotationType.CATEGORICAL.value,
                {
                    "name": "duplicate-name",
                    "description": "config description",
                    "optimizationDirection": "MAXIMIZE",
                    "values": [
                        {"label": "Good", "score": 1.0},
                        {"label": "Bad", "score": 0.0},
                    ],
                },
                id="categorical",
            ),
            pytest.param(
                AnnotationType.CONTINUOUS.value,
                {
                    "name": "duplicate-name",
                    "description": "config description",
                    "optimizationDirection": "MAXIMIZE",
                    "lowerBound": 0.0,
                    "upperBound": 1.0,
                },
                id="continuous",
            ),
            pytest.param(
                AnnotationType.FREEFORM.value,
                {
                    "name": "duplicate-name",
                    "description": "config description",
                },
                id="freeform",
            ),
        ],
    )
    async def test_cannot_create_annotation_config_with_duplicate_name(
        self,
        gql_client: AsyncGraphQLClient,
        annotation_type: str,
        config: dict[str, Any],
    ) -> None:
        annotation_type_key = annotation_type.lower()

        # Create first config
        create_response = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"annotationConfig": {annotation_type_key: config}}},
            operation_name="CreateAnnotationConfig",
        )
        assert create_response.data is not None
        assert not create_response.errors

        # Try to create duplicate config
        duplicate_create_response = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"annotationConfig": {annotation_type_key: config}}},
            operation_name="CreateAnnotationConfig",
        )
        assert duplicate_create_response.data is None
        assert duplicate_create_response.errors
        assert len(duplicate_create_response.errors) == 1
        error = duplicate_create_response.errors[0]
        assert "Annotation configuration with name 'duplicate-name' already exists" in error.message

    @pytest.mark.parametrize(
        ("annotation_type", "config"),
        [
            pytest.param(
                AnnotationType.CATEGORICAL.value,
                {
                    "name": "config-name",
                    "description": "config description",
                    "optimizationDirection": "MAXIMIZE",
                    "values": [
                        {"label": "Good", "score": 1.0},
                        {"label": "Bad", "score": 0.0},
                    ],
                },
                id="categorical",
            ),
            pytest.param(
                AnnotationType.CONTINUOUS.value,
                {
                    "name": "config-name",
                    "description": "config description",
                    "optimizationDirection": "MAXIMIZE",
                    "lowerBound": 0.0,
                    "upperBound": 1.0,
                },
                id="continuous",
            ),
            pytest.param(
                AnnotationType.FREEFORM.value,
                {
                    "name": "config-name",
                    "description": "config description",
                },
                id="freeform",
            ),
        ],
    )
    async def test_updated_annotation_config_name_cannot_collide_with_existing_config_name(
        self,
        gql_client: AsyncGraphQLClient,
        annotation_type: str,
        config: dict[str, Any],
    ) -> None:
        annotation_type_key = annotation_type.lower()

        # Create first config
        create_response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "annotationConfig": {
                        "freeform": {
                            "name": "collide-config-name",
                            "description": "config description",
                        }
                    }
                }
            },
            operation_name="CreateAnnotationConfig",
        )
        assert create_response.data is not None
        assert not create_response.errors

        # Create second config
        create_response = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"annotationConfig": {annotation_type_key: config}}},
            operation_name="CreateAnnotationConfig",
        )
        assert create_response.data is not None
        assert not create_response.errors
        config_id = create_response.data["createAnnotationConfig"]["annotationConfig"]["id"]

        # Try to create duplicate config
        config["name"] = "collide-config-name"
        duplicate_create_response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": config_id,
                    "annotationConfig": {annotation_type_key: config},
                },
            },
            operation_name="UpdateAnnotationConfig",
        )
        assert duplicate_create_response.data is None
        assert duplicate_create_response.errors
        assert len(duplicate_create_response.errors) == 1
        error = duplicate_create_response.errors[0]
        assert (
            "Annotation configuration with name 'collide-config-name' already exists"
            in error.message
        )

    async def test_update_annotation_config_not_found_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": str(GlobalID(type_name="CategoricalAnnotationConfig", node_id="999999")),
                    "annotationConfig": {
                        "freeform": {
                            "name": "test-config",
                            "description": "test description",
                        }
                    },
                }
            },
            operation_name="UpdateAnnotationConfig",
        )
        assert response.data is None
        assert response.errors
        assert len(response.errors) == 1
        error = response.errors[0]
        assert "Annotation config not found" in error.message
