/**
 * This file contains the old subscription for chat completion over dataset.
 * Used when the backgroundExperiments feature flag is disabled.
 */
import { graphql } from "react-relay";

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
graphql`
  subscription PlaygroundDatasetExamplesTableOldSubscription(
    $input: ChatCompletionOverDatasetInput!
  ) {
    chatCompletionOverDataset(input: $input) {
      __typename
      ... on TextChunk {
        content
        datasetExampleId
        repetitionNumber
      }
      ... on ToolCallChunk {
        id
        datasetExampleId
        repetitionNumber
        function {
          name
          arguments
        }
      }
      ... on ChatCompletionSubscriptionExperiment {
        experiment {
          id
        }
      }
      ... on ChatCompletionSubscriptionResult {
        datasetExampleId
        repetitionNumber
        span {
          id
          tokenCountTotal
          costSummary {
            total {
              cost
            }
          }
          latencyMs
          project {
            id
          }
          context {
            traceId
          }
        }
        experimentRun {
          id
        }
      }
      ... on ChatCompletionSubscriptionError {
        datasetExampleId
        repetitionNumber
        message
      }
      ... on EvaluationChunk {
        datasetExampleId
        repetitionNumber
        experimentRunEvaluation {
          id
          name
          label
          score
          annotatorKind
          explanation
          metadata
          startTime
          trace {
            traceId
            projectId
          }
        }
      }
      ... on EvaluationErrorChunk {
        datasetExampleId
        repetitionNumber
        evaluatorName
        message
      }
    }
  }
`;
