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
    for (const { project } of data.projects.edges) {
      if (project.endTime != null) {
        return redirect(`/projects/${project.id}`);
      }
    }
    const projectId = data?.projects.edges[0].project.id;
    return redirect(`/projects/${projectId}`);
  } else {
    throw new Error("No functionality available");
  }
}
