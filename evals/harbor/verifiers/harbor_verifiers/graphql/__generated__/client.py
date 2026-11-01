from typing import Any

from .base_client import BaseClient
from .dataset_evaluators import DatasetEvaluators
from .dataset_experiments import DatasetExperiments
from .evaluator_previews import EvaluatorPreviews
from .input_types import EvaluatorPreviewsInput


def gql(q: str) -> str:
    return q


class Client(BaseClient):
    def dataset_evaluators(self, dataset_id: str, **kwargs: Any) -> DatasetEvaluators:
        query = gql("""
            query DatasetEvaluators($datasetId: ID!) {
              node(id: $datasetId) {
                __typename
                ... on Dataset {
                  datasetEvaluators(first: 50) {
                    edges {
                      node {
                        ...DatasetEvaluatorFields
                      }
                    }
                  }
                }
              }
            }

            fragment DatasetEvaluatorFields on DatasetEvaluator {
              id
              name
              inputMapping {
                pathMapping
                literalMapping
              }
              outputConfigs {
                ...EvaluatorOutputConfigFields
              }
              evaluator {
                __typename
                id
                name
                kind
                ... on CodeEvaluator {
                  language
                  sourceCode
                  sandboxConfig {
                    id
                  }
                  outputConfigs {
                    ...EvaluatorOutputConfigFields
                  }
                }
              }
            }

            fragment EvaluatorOutputConfigFields on BuiltInEvaluatorOutputConfig {
              __typename
              ... on CategoricalAnnotationConfig {
                name
                description
                optimizationDirection
                values {
                  label
                  score
                }
              }
              ... on ContinuousAnnotationConfig {
                name
                description
                optimizationDirection
                lowerBound
                upperBound
              }
              ... on FreeformAnnotationConfig {
                name
                description
              }
            }
            """)
        variables: dict[str, object] = {"datasetId": dataset_id}
        response = self.execute(
            query=query,
            operation_name="DatasetEvaluators",
            variables=variables,
            **kwargs,
        )
        data = self.get_data(response)
        return DatasetEvaluators.model_validate(data)

    def dataset_experiments(self, dataset_id: str, **kwargs: Any) -> DatasetExperiments:
        query = gql("""
            query DatasetExperiments($datasetId: ID!) {
              node(id: $datasetId) {
                __typename
                ... on Dataset {
                  experiments(first: 200) {
                    edges {
                      node {
                        ...ExperimentFields
                      }
                    }
                  }
                }
              }
            }

            fragment ExperimentFields on Experiment {
              id
              name
              description
              metadata
              createdAt
              averageRunLatencyMs
              costSummary {
                total {
                  cost
                }
              }
              runs(first: 100) {
                edges {
                  node {
                    ...ExperimentRunFields
                  }
                }
              }
            }

            fragment ExperimentRunFields on ExperimentRun {
              id
              repetitionNumber
              error
              example {
                id
              }
              annotations(first: 50) {
                edges {
                  node {
                    name
                    score
                    label
                    startTime
                  }
                }
              }
            }
            """)
        variables: dict[str, object] = {"datasetId": dataset_id}
        response = self.execute(
            query=query,
            operation_name="DatasetExperiments",
            variables=variables,
            **kwargs,
        )
        data = self.get_data(response)
        return DatasetExperiments.model_validate(data)

    def evaluator_previews(
        self, input: EvaluatorPreviewsInput, **kwargs: Any
    ) -> EvaluatorPreviews:
        query = gql("""
            mutation EvaluatorPreviews($input: EvaluatorPreviewsInput!) {
              evaluatorPreviews(input: $input) {
                results {
                  error
                  annotation {
                    score
                    label
                  }
                }
              }
            }
            """)
        variables: dict[str, object] = {"input": input}
        response = self.execute(
            query=query,
            operation_name="EvaluatorPreviews",
            variables=variables,
            **kwargs,
        )
        data = self.get_data(response)
        return EvaluatorPreviews.model_validate(data)
