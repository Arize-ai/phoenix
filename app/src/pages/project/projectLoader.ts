import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { projectLoaderQuery } from "./__generated__/projectLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the project page
 */
export async function projectLoader(args: LoaderFunctionArgs) {
  const { projectId } = args.params;
  return await fetchQuery<projectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectLoaderQuery($id: GlobalID!) {
        project: node(id: $id) {
          id
          ... on Project {
            name
          }
        }
      }
    `,
    {
      id: projectId as string,
    }
  ).toPromise();
}
