import { fetchQuery, graphql } from "react-relay";
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectLoaderByNameQuery } from "./__generated__/projectLoaderByNameQuery.graphql";
import type { projectLoaderQuery } from "./__generated__/projectLoaderQuery.graphql";

const RELAY_GLOBAL_ID_PATTERN = /^[^:]+:[^:]+(?:[:][^:]+)*$/;

function looksLikeRelayGlobalId(value: string) {
  try {
    return RELAY_GLOBAL_ID_PATTERN.test(atob(value));
  } catch {
    return false;
  }
}

/**
 * Loads in the necessary page data for the project page
 */
export async function projectLoader({ params, request }: LoaderFunctionArgs) {
  const { projectId } = params;

  if (!projectId) {
    throw new Error("Project page requires a project ID or project name");
  }

  if (!looksLikeRelayGlobalId(projectId)) {
    const response = await fetchQuery<projectLoaderByNameQuery>(
      RelayEnvironment,
      graphql`
        query projectLoaderByNameQuery($name: String!) {
          getProjectByName(name: $name) {
            id
            name
          }
        }
      `,
      {
        name: projectId,
      }
    ).toPromise();

    if (response?.getProjectByName) {
      const url = new URL(request.url);
      url.pathname = url.pathname.replace(
        `/projects/${projectId}`,
        `/projects/${response.getProjectByName.id}`
      );
      throw redirect(`${url.pathname}${url.search}${url.hash}`);
    }
  }

  return await fetchQuery<projectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectLoaderQuery($id: ID!) {
        project: node(id: $id) {
          id
          ... on Project {
            name
          }
        }
      }
    `,
    {
      id: projectId,
    }
  ).toPromise();
}

export type ProjectLoaderData = Awaited<ReturnType<typeof projectLoader>>;
