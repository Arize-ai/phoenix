import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { layoutLoaderQuery as LayoutLoaderQuery } from "./__generated__/layoutLoaderQuery.graphql";

export const layoutLoaderQuery = graphql`
  query layoutLoaderQuery {
    projectCount
    datasetCount
    promptCount
    evaluatorCount
  }
`;

export function layoutLoader() {
  const queryRef = loadQuery<LayoutLoaderQuery>(
    RelayEnvironment,
    layoutLoaderQuery,
    {}
  );
  return { queryRef };
}

export type LayoutLoaderData = ReturnType<typeof layoutLoader>;
