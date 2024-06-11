import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router-dom";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { experimentsLoaderQuery } from "./__generated__/experimentsLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the experimentsLoader page
 */
export async function experimentsLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  return await fetchQuery<experimentsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query experimentsLoaderQuery($id: GlobalID!) {
        dataset: node(id: $id) {
          id
          ... on Dataset {
            ...ExperimentsTableFragment
          }
        }
      }
    `,
    {
      id: datasetId as string,
    }
  ).toPromise();
}
