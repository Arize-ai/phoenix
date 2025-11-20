import { graphql, loadQuery } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { examplesLoaderQuery } from "./__generated__/examplesLoaderQuery.graphql";

export const examplesLoaderGql = graphql`
  query examplesLoaderQuery($id: ID!) {
    dataset: node(id: $id) {
      id
      ...ExamplesTableFragment
    }
  }
`;

/**
 * Loads in the necessary page data for the dataset page
 */
export function examplesLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  return loadQuery<examplesLoaderQuery>(RelayEnvironment, examplesLoaderGql, {
    id: datasetId as string,
  });
}

export type ExamplesLoaderData = ReturnType<typeof examplesLoader>;
