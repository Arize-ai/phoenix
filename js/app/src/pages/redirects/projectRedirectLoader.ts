import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectRedirectLoaderQuery } from "./__generated__/projectRedirectLoaderQuery.graphql";

export async function projectRedirectLoader({ params }: LoaderFunctionArgs) {
  const { project_name: projectName } = params;

  if (!projectName) {
    throw new Error("Project redirect requires a project name");
  }

  const response = await fetchQuery<projectRedirectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectRedirectLoaderQuery($name: String!) {
        getProjectByName(name: $name) {
          id
        }
      }
    `,
    {
      name: projectName,
    }
  ).toPromise();

  if (response?.getProjectByName) {
    return redirect(`/projects/${response.getProjectByName.id}`);
  } else {
    throw new Error(`Project with name "${projectName}" not found`);
  }
}
