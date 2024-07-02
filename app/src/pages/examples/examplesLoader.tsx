import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router-dom";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { examplesLoaderQuery } from "./__generated__/examplesLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the dataset page
 */
export async function examplesLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  return await fetchQuery<examplesLoaderQuery>(
    RelayEnvironment,
    graphql`
      query examplesLoaderQuery($id: GlobalID!) {
        dataset: node(id: $id) {
          id
          ...ExamplesTableFragment
        }
      }
    `,
    {
      id: datasetId as string,
    }
  ).toPromise();
}
