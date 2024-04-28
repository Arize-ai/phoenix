import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router-dom";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { homeLoaderQuery } from "./__generated__/homeLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the home page
 * makes a determination about the available functionality
 */
export async function homeLoader(_args: LoaderFunctionArgs) {
  const data = await fetchQuery<homeLoaderQuery>(
    RelayEnvironment,
    graphql`
      query homeLoaderQuery {
        functionality {
          modelInferences
        }
        projects {
          edges {
            project: node {
              id
              endTime
            }
          }
        }
      }
    `,
    {}
  ).toPromise();

  if (data?.functionality.modelInferences) {
    return redirect("/model");
  } else if (data?.projects.edges?.length) {
    // Detect if there is only a single project with data. If that's the case, redirect to that project
    let numProjectsWithData = 0,
      projectIdWithData = null;
    for (const { project } of data.projects.edges) {
      if (project.endTime != null) {
        numProjectsWithData++;
        projectIdWithData = project.id;
      }
    }
    if (numProjectsWithData > 1) {
      // There are multiple projects with data, redirect to projects
      return redirect("/projects");
    } else if (numProjectsWithData === 1 && projectIdWithData != null) {
      // There is only one project with data, redirect to that project
      return redirect(`/projects/${projectIdWithData}`);
    }
    // Fallback to the default project
    const projectId = data?.projects.edges[0].project.id;
    return redirect(`/projects/${projectId}`);
  } else {
    throw new Error("No functionality available");
  }
}
