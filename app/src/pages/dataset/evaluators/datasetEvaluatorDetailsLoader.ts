import { fetchQuery, graphql, loadQuery } from "react-relay";
import { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { datasetEvaluatorDetailsLoaderQuery } from "./__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";

export const datasetEvaluatorDetailsLoaderGQL = graphql`
  query datasetEvaluatorDetailsLoaderQuery(
    $datasetId: ID!
    $datasetEvaluatorId: ID!
    $timeRange: TimeRange
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
            ...DatasetEvaluatorTraces_project
          }
          ...BuiltInDatasetEvaluatorDetails_datasetEvaluator
          ...LLMDatasetEvaluatorDetails_datasetEvaluator
        }
      }
    }
  }
`;

export type DatasetEvaluatorDetailsLoaderData = Awaited<
  ReturnType<typeof datasetEvaluatorDetailsLoader>
>;

/**
 * Loads the data required for the dataset evaluator details page
 */
export async function datasetEvaluatorDetailsLoader(
  args: LoaderFunctionArgs
): Promise<{
  queryRef: ReturnType<typeof loadQuery<datasetEvaluatorDetailsLoaderQuery>>;
  evaluatorDisplayName: string | null;
  projectId: string | null;
}> {
  const { datasetId, evaluatorId } = args.params;
  invariant(datasetId, "datasetId is required");
  invariant(evaluatorId, "evaluatorId is required");

  const data = await fetchQuery<datasetEvaluatorDetailsLoaderQuery>(
    RelayEnvironment,
    datasetEvaluatorDetailsLoaderGQL,
    { datasetId, datasetEvaluatorId: evaluatorId }
  ).toPromise();

  const queryRef = loadQuery<datasetEvaluatorDetailsLoaderQuery>(
    RelayEnvironment,
    datasetEvaluatorDetailsLoaderGQL,
    { datasetId, datasetEvaluatorId: evaluatorId }
  );

  const evaluatorDisplayName = data?.dataset?.datasetEvaluator?.name ?? null;

  const projectId = data?.dataset?.datasetEvaluator?.project?.id ?? null;

  return {
    queryRef,
    evaluatorDisplayName,
    projectId,
  };
}
