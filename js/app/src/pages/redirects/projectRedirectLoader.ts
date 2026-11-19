import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectRedirectLoaderQuery } from "./__generated__/projectRedirectLoaderQuery.graphql";
import { notFound } from "./notFound";

/**
 * Resolves a project name to its global ID, responding with the project
 * not-found error when no project has that name.
 */
export async function getProjectIdByName(projectName: string) {
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

  if (!response?.getProjectByName) {
    throw notFound({ kind: "project-onboarding", projectName });
  }
  return response.getProjectByName.id;
}

export async function projectRedirectLoader({ params }: LoaderFunctionArgs) {
  const { project_name: projectName } = params;

  if (!projectName) {
    throw new Error("Project redirect requires a project name");
  }

  return redirect(`/projects/${await getProjectIdByName(projectName)}`);
}
