from typing import Any, Optional, Union

from .base_client import BaseClient
from .base_model import UNSET, UnsetType
from .dataset_evaluators import DatasetEvaluators
from .dataset_experiments import DatasetExperiments
from .evaluator_previews import EvaluatorPreviews
from .experiment_runs import ExperimentRuns
from .generative_models import GenerativeModels
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

    def experiment_runs(
        self,
        experiment_id: str,
        after: Union[Optional[str], UnsetType] = UNSET,
        **kwargs: Any,
    ) -> ExperimentRuns:
        query = gql("""
            query ExperimentRuns($experimentId: ID!, $after: String) {
              node(id: $experimentId) {
                __typename
                ... on Experiment {
                  runs(first: 50, after: $after) {
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                    edges {
                      node {
                        id
                        traceId
                        error
                        output
                        annotations(first: 50) {
                          edges {
                            node {
                              name
                              label
                              score
                              explanation
                            }
                          }
                        }
                        example {
                          id
                          revision {
                            input
                            output
                            metadata
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            """)
        variables: dict[str, object] = {"experimentId": experiment_id, "after": after}
        response = self.execute(
            query=query, operation_name="ExperimentRuns", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return ExperimentRuns.model_validate(data)

    def generative_models(
        self, after: Union[Optional[str], UnsetType] = UNSET, **kwargs: Any
    ) -> GenerativeModels:
        query = gql("""
            query GenerativeModels($after: String) {
              generativeModels(first: 100, after: $after) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                edges {
                  node {
                    name
                    namePattern
                    kind
                    provider
                    tokenPrices {
                      tokenType
                      kind
                      costPerToken
                      costPerMillionTokens
                    }
                  }
                }
              }
            }
            """)
        variables: dict[str, object] = {"after": after}
        response = self.execute(
            query=query,
            operation_name="GenerativeModels",
            variables=variables,
            **kwargs,
        )
        data = self.get_data(response)
        return GenerativeModels.model_validate(data)
