import pytest
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def project(db: DbSessionFactory) -> None:
    """Inserts a project into the database."""
    async with db() as session:
        project = models.Project(
            name=DEFAULT_PROJECT_NAME,
        )
        session.add(project)
        await session.flush()


class TestAnnotationConfigMutations:
    CREATE_CATEGORICAL_ANNOTATION_CONFIG_MUTATION = """
      mutation ($input: CreateAnnotationConfigInput!) {
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
    """

    UPDATE_CATEGORICAL_ANNOTATION_CONFIG_MUTATION = """
      mutation ($input: UpdateAnnotationConfigInput!) {
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
    """

    LIST_ANNOTATION_CONFIGS_QUERY = """
      {
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
    """

    ADD_ANNOTATION_CONFIG_TO_PROJECT_MUTATION = """
      mutation ($input: [AddAnnotationConfigToProjectInput!]!) {
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
    """

    REMOVE_ANNOTATION_CONFIG_FROM_PROJECT_MUTATION = """
      mutation ($input: [RemoveAnnotationConfigFromProjectInput!]!) {
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
    """

    DELETE_ANNOTATION_CONFIGS_MUTATION = """
      mutation ($input: DeleteAnnotationConfigsInput!) {
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

    async def test_categorical_annotation_config_lifecycle(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        project: None,
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
            self.CREATE_CATEGORICAL_ANNOTATION_CONFIG_MUTATION,
            create_input,
        )
        assert not create_response.errors
        assert (data := create_response.data) is not None
        created_config = data["createAnnotationConfig"]["annotationConfig"]
        config_id = created_config["id"]
        assert created_config["name"] == "Test Categorical Config"
        assert created_config["description"] == "Test description"
        assert created_config["optimizationDirection"] == "MAXIMIZE"
        assert len(created_config["values"]) == 2
        assert created_config["values"][0]["label"] == "Good"
        assert created_config["values"][0]["score"] == 1.0
        assert created_config["values"][1]["label"] == "Bad"
        assert created_config["values"][1]["score"] == 0.0

        # List annotation configs
        list_response = await gql_client.execute(self.LIST_ANNOTATION_CONFIGS_QUERY)
        assert not list_response.errors
        assert (data := list_response.data) is not None
        configs = data["annotationConfigs"]["edges"]
        assert len(configs) == 1
        assert configs[0]["node"]["id"] == config_id

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
            self.UPDATE_CATEGORICAL_ANNOTATION_CONFIG_MUTATION,
            update_input,
        )
        assert not update_response.errors
        assert (data := update_response.data) is not None
        updated_config = data["updateAnnotationConfig"]["annotationConfig"]
        assert updated_config["name"] == "Updated Categorical Config"
        assert updated_config["description"] == "Updated description"
        assert updated_config["optimizationDirection"] == "MINIMIZE"
        assert len(updated_config["values"]) == 2
        assert updated_config["values"][0]["label"] == "Excellent"
        assert updated_config["values"][0]["score"] == 1.0
        assert updated_config["values"][1]["label"] == "Poor"
        assert updated_config["values"][1]["score"] == 0.0

        # Add annotation config to project
        project_id = str(GlobalID("Project", "1"))
        add_to_project_input = {
            "input": [
                {
                    "projectId": project_id,
                    "annotationConfigId": config_id,
                }
            ]
        }
        add_response = await gql_client.execute(
            self.ADD_ANNOTATION_CONFIG_TO_PROJECT_MUTATION,
            add_to_project_input,
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
            self.REMOVE_ANNOTATION_CONFIG_FROM_PROJECT_MUTATION,
            remove_from_project_input,
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
            self.DELETE_ANNOTATION_CONFIGS_MUTATION,
            delete_input,
        )
        assert not delete_response.errors
        assert (data := delete_response.data) is not None
        deleted_configs = data["deleteAnnotationConfigs"]["annotationConfigs"]
        assert len(deleted_configs) == 1
        assert deleted_configs[0]["id"] == config_id

        # Verify the config is deleted by listing
        list_response = await gql_client.execute(self.LIST_ANNOTATION_CONFIGS_QUERY)
        assert not list_response.errors
        assert (data := list_response.data) is not None
        configs = data["annotationConfigs"]["edges"]
        assert len(configs) == 0
