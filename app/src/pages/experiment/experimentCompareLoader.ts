import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type {
  experimentCompareLoaderQuery,
  experimentCompareLoaderQuery$data,
} from "./__generated__/experimentCompareLoaderQuery.graphql";

export type ExperimentCompareLoaderReturnType =
  | experimentCompareLoaderQuery$data
  | undefined;

/**
 * Loads in the necessary page data for the compare experiment page
 */
export async function experimentCompareLoader(
  args: LoaderFunctionArgs
): Promise<ExperimentCompareLoaderReturnType> {
  const { datasetId } = args.params;
  if (datasetId == null) {
    throw new Error("Dataset ID is required");
  }
  const url = new URL(args.request.url);
  const [baseExperimentId = undefined, ...compareExperimentIds] =
    url.searchParams.getAll("experimentId");
  const isMetricsView = url.searchParams.get("view") === "metrics";

  return await fetchQuery<experimentCompareLoaderQuery>(
    RelayEnvironment,
    graphql`
      query experimentCompareLoaderQuery(
        $datasetId: ID!
        $baseExperimentId: ID!
        $compareExperimentIds: [ID!]!
        $hasBaseExperiment: Boolean!
        $isMetricsView: Boolean!
      ) {
        ...ExperimentCompareTable_comparisons
          @include(if: $hasBaseExperiment)
          @arguments(
            baseExperimentId: $baseExperimentId
            compareExperimentIds: $compareExperimentIds
            datasetId: $datasetId
          )
        ...ExperimentMultiSelector__data
          @arguments(hasBaseExperiment: $hasBaseExperiment)
        ...ExperimentCompareMetricsPage_experiments
          @include(if: $isMetricsView)
          @arguments(
            baseExperimentId: $baseExperimentId
            compareExperimentIds: $compareExperimentIds
            datasetId: $datasetId
          )
      }
    `,
    {
      datasetId,
      baseExperimentId: baseExperimentId ?? "",
      compareExperimentIds,
      hasBaseExperiment: baseExperimentId != null,
      isMetricsView,
    }
  ).toPromise();
}
