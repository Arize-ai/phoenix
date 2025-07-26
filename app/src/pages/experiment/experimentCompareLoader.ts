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
 * Loads in the necessary page data for the compare experiment grid page
 */
export async function experimentCompareLoader(
  args: LoaderFunctionArgs
): Promise<ExperimentCompareLoaderReturnType> {
  const { datasetId } = args.params;
  if (datasetId == null) {
    throw new Error("Dataset ID is required");
  }
  const url = new URL(args.request.url);
  const [baselineExperimentId = undefined] =
    url.searchParams.getAll("experimentId");

  return await fetchQuery<experimentCompareLoaderQuery>(
    RelayEnvironment,
    graphql`
      query experimentCompareLoaderQuery(
        $datasetId: ID!
        $baselineExperimentId: ID!
        $hasBaselineExperimentId: Boolean!
      ) {
        ...ExperimentMultiSelector__data
          @arguments(hasBaselineExperimentId: $hasBaselineExperimentId)
      }
    `,
    {
      datasetId,
      baselineExperimentId: baselineExperimentId ?? "",
      hasBaselineExperimentId: baselineExperimentId != null,
    }
  ).toPromise();
}
