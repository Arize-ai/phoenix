import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type {
  experimentCompareLoaderQuery,
  experimentCompareLoaderQuery$data,
} from "./__generated__/experimentCompareLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the compare experiment page
 */
export async function experimentCompareLoader(
  args: LoaderFunctionArgs
): Promise<experimentCompareLoaderQuery$data | undefined> {
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
        $hasCompareExperiments: Boolean!
        $includeGridView: Boolean!
        $includeListView: Boolean!
        $includeMetricsView: Boolean!
      ) {
        ...ExperimentComparePage_selectedCompareExperiments
          @arguments(datasetId: $datasetId, experimentIds: $experimentIds)
        ...ExperimentCompareTable_comparisons
          @include(if: $includeGridView)
          @arguments(
            datasetId: $datasetId
            baseExperimentId: $baseExperimentId
            compareExperimentIds: $compareExperimentIds
            experimentIds: $experimentIds
          )
        ...ExperimentCompareListPage_comparisons
          @include(if: $includeListView)
          @arguments(
            baseExperimentId: $baseExperimentId
            compareExperimentIds: $compareExperimentIds
          )
        ...ExperimentCompareListPage_aggregateData
          @include(if: $includeListView)
          @arguments(datasetId: $datasetId, experimentIds: $experimentIds)
        ...ExperimentCompareMetricsPage_experiments
          @include(if: $includeMetricsView)
          @arguments(
            datasetId: $datasetId
            baseExperimentId: $baseExperimentId
            compareExperimentIds: $compareExperimentIds
            experimentIds: $experimentIds
            hasCompareExperiments: $hasCompareExperiments
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
      includeGridView: view === "grid" && baseExperimentId != null,
      includeListView: view === "list" && baseExperimentId != null,
      includeMetricsView: view === "metrics" && baseExperimentId != null,
      hasCompareExperiments: compareExperimentIds.length > 0,
    }
  ).toPromise();
}
