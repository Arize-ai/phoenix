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
  const [baselineExperimentId = undefined, ...compareExperimentIds] =
    url.searchParams.getAll("experimentId");

  return await fetchQuery<experimentCompareLoaderQuery>(
    RelayEnvironment,
    graphql`
      query experimentCompareLoaderQuery(
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
        ...ExperimentMultiSelector__data
          @arguments(hasBaselineExperimentId: $hasBaselineExperimentId)
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
