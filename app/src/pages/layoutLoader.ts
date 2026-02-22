import { fetchQuery, graphql } from "react-relay";

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

export async function layoutLoader() {
  return await fetchQuery<layoutLoaderQuery>(
    RelayEnvironment,
    layoutLoaderGql,
    {}
  ).toPromise();
}

export type LayoutLoaderData = Awaited<ReturnType<typeof layoutLoader>>;
