import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type {
  experimentCompareGridLoaderQuery,
  experimentCompareGridLoaderQuery$data,
} from "./__generated__/experimentCompareGridLoaderQuery.graphql";

export type ExperimentCompareGridLoaderReturnType =
  | experimentCompareGridLoaderQuery$data
  | undefined;

/**
 * Loads in the necessary page data for the compare experiment grid page
 */
export async function experimentCompareGridLoader(
  args: LoaderFunctionArgs
): Promise<ExperimentCompareGridLoaderReturnType> {
  const { datasetId } = args.params;
  if (datasetId == null) {
    throw new Error("Dataset ID is required");
  }
  const url = new URL(args.request.url);
  const [baselineExperimentId = undefined, ...compareExperimentIds] =
    url.searchParams.getAll("experimentId");

  return await fetchQuery<experimentCompareGridLoaderQuery>(
    RelayEnvironment,
    graphql`
      query experimentCompareGridLoaderQuery(
        $datasetId: ID!
        $baselineExperimentId: ID!
        $compareExperimentIds: [ID!]!
        $hasBaselineExperimentId: Boolean!
      ) {
        ...ExperimentCompareTable_comparisons
          @include(if: $hasBaselineExperimentId)
          @arguments(
            baselineExperimentId: $baselineExperimentId
            compareExperimentIds: $compareExperimentIds
            datasetId: $datasetId
          )
      }
    `,
    {
      datasetId,
      baselineExperimentId: baselineExperimentId ?? "",
      compareExperimentIds,
      hasBaselineExperimentId: baselineExperimentId != null,
    }
  ).toPromise();
}
