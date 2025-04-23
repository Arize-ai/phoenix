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
            projectAnnotationConfigAssociations {
                projectId
                annotationConfigId
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
            projectAnnotationConfigAssociations {
                projectId
                annotationConfigId
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
            operation_name="CreateAnnotationConfig",
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
            operation_name="UpdateAnnotationConfig",
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
        assert project_configs[0]["node"] == expected_config
        project_config_associations = data["addAnnotationConfigToProject"][
            "projectAnnotationConfigAssociations"
        ]
        assert len(project_config_associations) == 1
        assert project_config_associations[0] == {
            "projectId": project_id,
            "annotationConfigId": config_id,
        }

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

    async def test_continuous_annotation_config_crud_operations(
        self,
        gql_client: AsyncGraphQLClient,
        project: models.Project,
    ) -> None:
        # Create a continuous annotation config
        create_input = {
            "input": {
                "annotationConfig": {
                    "continuous": {
                        "name": "Test Continuous Config",
                        "description": "Test description",
                        "optimizationDirection": "MAXIMIZE",
                        "lowerBound": 0.0,
                        "upperBound": 1.0,
                    }
                }
            }
        }
        create_response = await gql_client.execute(
            query=self.QUERY,
            variables=create_input,
            operation_name="CreateAnnotationConfig",
        )
        assert not create_response.errors
        assert (data := create_response.data) is not None
        created_config = data["createAnnotationConfig"]["annotationConfig"]
        config_id = created_config["id"]
        expected_config = {
            "name": "Test Continuous Config",
            "id": config_id,
            "description": "Test description",
            "annotationType": "CONTINUOUS",
            "optimizationDirection": "MAXIMIZE",
            "lowerBound": 0.0,
            "upperBound": 1.0,
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
                    "continuous": {
                        "name": "Updated Continuous Config",
                        "description": "Updated description",
                        "optimizationDirection": "MINIMIZE",
                        "lowerBound": -1.0,
                        "upperBound": 2.0,
                    }
                },
            }
        }
        update_response = await gql_client.execute(
            query=self.QUERY,
            variables=update_input,
            operation_name="UpdateAnnotationConfig",
        )
        assert not update_response.errors
        assert (data := update_response.data) is not None
        updated_config = data["updateAnnotationConfig"]["annotationConfig"]
        expected_config = {
            "name": "Updated Continuous Config",
            "id": config_id,
            "description": "Updated description",
            "annotationType": "CONTINUOUS",
            "optimizationDirection": "MINIMIZE",
            "lowerBound": -1.0,
            "upperBound": 2.0,
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
        assert project_configs[0]["node"] == expected_config
        project_config_associations = data["addAnnotationConfigToProject"][
            "projectAnnotationConfigAssociations"
        ]
        assert len(project_config_associations) == 1
        assert project_config_associations[0] == {
            "projectId": project_id,
            "annotationConfigId": config_id,
        }

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

    async def test_freeform_annotation_config_crud_operations(
        self,
        gql_client: AsyncGraphQLClient,
        project: models.Project,
    ) -> None:
        # Create a freeform annotation config
        create_input = {
            "input": {
                "annotationConfig": {
                    "freeform": {
                        "name": "Test Freeform Config",
                        "description": "Test description",
                    }
                }
            }
        }
        create_response = await gql_client.execute(
            query=self.QUERY,
            variables=create_input,
            operation_name="CreateAnnotationConfig",
        )
        assert not create_response.errors
        assert (data := create_response.data) is not None
        created_config = data["createAnnotationConfig"]["annotationConfig"]
        config_id = created_config["id"]
        expected_config = {
            "name": "Test Freeform Config",
            "id": config_id,
            "description": "Test description",
            "annotationType": "FREEFORM",
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
                    "freeform": {
                        "name": "Updated Freeform Config",
                        "description": "Updated description",
                    }
                },
            }
        }
        update_response = await gql_client.execute(
            query=self.QUERY,
            variables=update_input,
            operation_name="UpdateAnnotationConfig",
        )
        assert not update_response.errors
        assert (data := update_response.data) is not None
        updated_config = data["updateAnnotationConfig"]["annotationConfig"]
        expected_config = {
            "name": "Updated Freeform Config",
            "id": config_id,
            "description": "Updated description",
            "annotationType": "FREEFORM",
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
        assert project_configs[0]["node"] == expected_config
        project_config_associations = data["addAnnotationConfigToProject"][
            "projectAnnotationConfigAssociations"
        ]
        assert len(project_config_associations) == 1
        assert project_config_associations[0] == {
            "projectId": project_id,
            "annotationConfigId": config_id,
        }

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
