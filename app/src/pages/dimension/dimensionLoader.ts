import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { dimensionLoaderQuery } from "./__generated__/dimensionLoaderQuery.graphql";

/**
 * Loads in the necessary page data, e.g. info about the embedding
 */
export async function dimensionLoader(args: LoaderFunctionArgs) {
  const { dimensionId } = args.params;
  return fetchQuery<dimensionLoaderQuery>(
    RelayEnvironment,
    graphql`
      query dimensionLoaderQuery($id: GlobalID!) {
        dimension: node(id: $id) {
          ... on Dimension {
            id
            name
            dataType
            shape
          }
        }
      }
    `,
    {
      id: dimensionId as string,
    }
  ).toPromise();
}
