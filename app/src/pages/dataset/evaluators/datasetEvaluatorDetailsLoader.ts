import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { datasetEvaluatorDetailsLoaderQuery } from "./__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";

export const datasetEvaluatorDetailsLoaderGQL = graphql`
  query datasetEvaluatorDetailsLoaderQuery(
    $datasetId: ID!
    $datasetEvaluatorId: ID!
    $timeRange: TimeRange
    $orphanSpanAsRootSpan: Boolean!
  ) {
    dataset: node(id: $datasetId) {
      id
      ... on Dataset {
        id
        datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {
          id
          name
          description
          evaluator {
            __typename
            kind
            description
          }
          project {
            id
            ...DatasetEvaluatorSpans_project
          }
          ...BuiltInDatasetEvaluatorDetails_datasetEvaluator
          ...LLMDatasetEvaluatorDetails_datasetEvaluator
        }
      }
    }
  }
`;

export type DatasetEvaluatorDetailsLoaderData = ReturnType<
  typeof datasetEvaluatorDetailsLoader
>;

/**
 * Loads the data required for the dataset evaluator details page
 */
export function datasetEvaluatorDetailsLoader(args: LoaderFunctionArgs) {
  const { datasetId, evaluatorId } = args.params;
  invariant(datasetId, "datasetId is required");
  invariant(evaluatorId, "evaluatorId is required");

  const queryRef = loadQuery<datasetEvaluatorDetailsLoaderQuery>(
    RelayEnvironment,
    datasetEvaluatorDetailsLoaderGQL,
    { datasetId, datasetEvaluatorId: evaluatorId, orphanSpanAsRootSpan: true }
  );

  return {
    queryRef,
  };
}
