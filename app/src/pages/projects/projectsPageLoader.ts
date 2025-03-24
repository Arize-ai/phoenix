import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { projectsPageLoaderQuery } from "./__generated__/projectsPageLoaderQuery.graphql";

export async function projectsPageLoader() {
  const loaderData = await fetchQuery<projectsPageLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectsPageLoaderQuery {
        ...ProjectsPageProjectsFragment
      }
    `,
    {}
  ).toPromise();

  return loaderData;
}
