import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { projectsLoaderQuery } from "./__generated__/projectsLoaderQuery.graphql";

export async function projectsLoader() {
  const loaderData = await fetchQuery<projectsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectsLoaderQuery {
        ...ProjectsPageProjectsFragment
      }
    `,
    {}
  ).toPromise();
  return loaderData;
}
