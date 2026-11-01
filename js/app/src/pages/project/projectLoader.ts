import { fetchQuery, graphql } from "react-relay";
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { getProjectIdByName } from "@phoenix/pages/redirects/projectRedirectLoader";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import { prependBasename } from "@phoenix/utils/routingUtils";

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
    const id = await getProjectIdByName(projectId);
    // Resolved against the basename-free route: the router prepends the
    // basename to redirects, and params are decoded while the URL is not.
    const { pathname, search } = new URL(request.url);
    const subpath = pathname
      .slice(prependBasename("/projects/").length)
      .replace(/^[^/]*/, "");
    throw redirect(`/projects/${encodeURIComponent(id)}${subpath}${search}`);
  }

  return await fetchQuery<projectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectLoaderQuery($id: ID!) {
        project: node(id: $id) {
          id
          ... on Project {
            name
            # Fetched on every visit, so the Relay store answer that
            # ProjectOnboardingOverlay decides from on mount is never stale.
            hasTraces
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
