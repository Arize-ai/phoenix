import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { datasetLoaderQuery } from "./__generated__/datasetLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the dataset page
 */
export async function datasetLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  return await fetchQuery<datasetLoaderQuery>(
    RelayEnvironment,
    graphql`
      query datasetLoaderQuery($id: ID!) {
        dataset: node(id: $id) {
          id
          ... on Dataset {
            id
            name
            description
            exampleCount
            experimentCount
            latestVersions: versions(
              first: 1
              sort: { col: createdAt, dir: desc }
            ) {
              edges {
                version: node {
                  id
                  description
                  createdAt
                }
              }
            }
          }
        }
      }
    `,
    {
      id: datasetId as string,
    }
  ).toPromise();
}
