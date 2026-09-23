import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { layoutLoaderQuery } from "./__generated__/layoutLoaderQuery.graphql";

export const layoutLoaderGql = graphql`
  query layoutLoaderQuery {
    projectCount
    datasetCount
    promptCount
    evaluatorCount
  }
`;

export function layoutLoader() {
  const queryRef = loadQuery<layoutLoaderQuery>(
    RelayEnvironment,
    layoutLoaderGql,
    {},
    { fetchPolicy: "store-and-network" }
  );

  return { queryRef };
}

export type LayoutLoaderData = ReturnType<typeof layoutLoader>;
