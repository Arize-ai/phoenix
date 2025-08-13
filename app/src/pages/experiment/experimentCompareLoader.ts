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
  const view = url.searchParams.get("view") || "grid";

  return await fetchQuery<experimentCompareLoaderQuery>(
    RelayEnvironment,
    graphql`
      query experimentCompareLoaderQuery(
        $datasetId: ID!
        $baseExperimentId: ID!
        $compareExperimentIds: [ID!]!
        $experimentIds: [ID!]!
        $hasBaseExperiment: Boolean!
        $includeGridView: Boolean!
        $includeMetricsView: Boolean!
      ) {
        ...ExperimentCompareTable_comparisons
          @include(if: $includeGridView)
          @arguments(
            datasetId: $datasetId
            baseExperimentId: $baseExperimentId
            compareExperimentIds: $compareExperimentIds
            experimentIds: $experimentIds
          )
        ...ExperimentMultiSelector__data
          @arguments(
            datasetId: $datasetId
            hasBaseExperiment: $hasBaseExperiment
          )
        ...ExperimentComparePage_selectedCompareExperiments
          @arguments(datasetId: $datasetId, experimentIds: $experimentIds)
        ...ExperimentCompareMetricsPage_experiments
          @include(if: $includeMetricsView)
          @arguments(
            datasetId: $datasetId
            baseExperimentId: $baseExperimentId
            compareExperimentIds: $compareExperimentIds
            experimentIds: $experimentIds
          )
      }
    `,
    {
      datasetId,
      baseExperimentId: baseExperimentId ?? "",
      compareExperimentIds,
      experimentIds: [
        ...(baseExperimentId ? [baseExperimentId] : []),
        ...compareExperimentIds,
      ],
      hasBaseExperiment: baseExperimentId != null,
      includeGridView: view === "grid" && baseExperimentId != null,
      includeMetricsView: view === "metrics" && baseExperimentId != null,
    }
  ).toPromise();
}
