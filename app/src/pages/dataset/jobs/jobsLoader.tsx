import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { jobsLoaderQuery } from "./__generated__/jobsLoaderQuery.graphql";

/**
 * Loads the dataset data required for the jobs page
 */
export async function jobsLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  return await fetchQuery<jobsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query jobsLoaderQuery($id: ID!) {
        dataset: node(id: $id) {
          id
          ... on Dataset {
            id
            ...JobsPage_jobs
          }
        }
      }
    `,
    {
      id: datasetId as string,
    }
  ).toPromise();
}
