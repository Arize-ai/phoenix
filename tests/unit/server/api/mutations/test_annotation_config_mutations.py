import pytest
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
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
    mutation CreateCategoricalAnnotationConfig($input: CreateAnnotationConfigInput!) {
        createAnnotationConfig(input: $input) {
            annotationConfig {
                ... on CategoricalAnnotationConfig {
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
            }
        }
    }

    mutation UpdateCategoricalAnnotationConfig($input: UpdateAnnotationConfigInput!) {
        updateAnnotationConfig(input: $input) {
            annotationConfig {
                ... on CategoricalAnnotationConfig {
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
            }
        }
    }

    query ListAnnotationConfigs {
        annotationConfigs(first: 10) {
            edges {
                node {
                    ... on CategoricalAnnotationConfig {
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
                        }
                    }
                }
            }
            projectAnnotationConfigAssociations {
                projectId
                annotationConfigId
            }
        }
    }

    mutation DeleteAnnotationConfigs($input: DeleteAnnotationConfigsInput!) {
        deleteAnnotationConfigs(input: $input) {
            annotationConfigs {
                ... on CategoricalAnnotationConfig {
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
            }
        }
    }
    """

    async def test_categorical_annotation_config_crud_operations(
        self,
        gql_client: AsyncGraphQLClient,
        project: models.Project,
    ) -> None:
        # Create a categorical annotation config
        create_input = {
            "input": {
                "annotationConfig": {
                    "categorical": {
                        "name": "Test Categorical Config",
                        "description": "Test description",
                        "optimizationDirection": "MAXIMIZE",
                        "values": [
                            {"label": "Good", "score": 1.0},
                            {"label": "Bad", "score": 0.0},
                        ],
                    }
                }
            }
        }
        create_response = await gql_client.execute(
            query=self.QUERY,
            variables=create_input,
            operation_name="CreateCategoricalAnnotationConfig",
        )
        assert not create_response.errors
        assert (data := create_response.data) is not None
        created_config = data["createAnnotationConfig"]["annotationConfig"]
        config_id = created_config["id"]
        expected_config = {
            "name": "Test Categorical Config",
            "id": config_id,
            "description": "Test description",
            "annotationType": "CATEGORICAL",
            "optimizationDirection": "MAXIMIZE",
            "values": [
                {
                    "label": "Good",
                    "score": 1.0,
                },
                {
                    "label": "Bad",
                    "score": 0.0,
                },
            ],
        }
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
        update_input = {
            "input": {
                "id": config_id,
                "annotationConfig": {
                    "categorical": {
                        "name": "Updated Categorical Config",
                        "description": "Updated description",
                        "optimizationDirection": "MINIMIZE",
                        "values": [
                            {"label": "Excellent", "score": 1.0},
                            {"label": "Poor", "score": 0.0},
                        ],
                    }
                },
            }
        }
        update_response = await gql_client.execute(
            query=self.QUERY,
            variables=update_input,
            operation_name="UpdateCategoricalAnnotationConfig",
        )
        assert not update_response.errors
        assert (data := update_response.data) is not None
        updated_config = data["updateAnnotationConfig"]["annotationConfig"]
        expected_config = {
            "name": "Updated Categorical Config",
            "id": config_id,
            "description": "Updated description",
            "annotationType": "CATEGORICAL",
            "optimizationDirection": "MINIMIZE",
            "values": [{"label": "Excellent", "score": 1.0}, {"label": "Poor", "score": 0.0}],
        }
        assert updated_config == expected_config

        # Add annotation config to project
        project_id = str(GlobalID("Project", str(project.id)))
        add_to_project_input = {
            "input": [
                {
                    "projectId": project_id,
                    "annotationConfigId": config_id,
                }
            ]
        }
        add_response = await gql_client.execute(
            query=self.QUERY,
            variables=add_to_project_input,
            operation_name="AddAnnotationConfigToProject",
        )
        assert not add_response.errors
        assert (data := add_response.data) is not None
        project_configs = data["addAnnotationConfigToProject"]["project"]["annotationConfigs"][
            "edges"
        ]
        assert len(project_configs) == 1
        assert project_configs[0]["node"]["id"] == config_id

        # Remove annotation config from project
        remove_from_project_input = {
            "input": [
                {
                    "projectId": project_id,
                    "annotationConfigId": config_id,
                }
            ]
        }
        remove_response = await gql_client.execute(
            query=self.QUERY,
            variables=remove_from_project_input,
            operation_name="RemoveAnnotationConfigFromProject",
        )
        assert not remove_response.errors
        assert (data := remove_response.data) is not None
        project_configs = data["removeAnnotationConfigFromProject"]["project"]["annotationConfigs"][
            "edges"
        ]
        assert len(project_configs) == 0
        associations = data["removeAnnotationConfigFromProject"][
            "projectAnnotationConfigAssociations"
        ]
        assert len(associations) == 1
        assert associations[0]["projectId"] == project_id
        assert associations[0]["annotationConfigId"] == config_id

        # Delete the annotation config
        delete_input = {
            "input": {
                "ids": [config_id],
            }
        }
        delete_response = await gql_client.execute(
            query=self.QUERY,
            variables=delete_input,
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
