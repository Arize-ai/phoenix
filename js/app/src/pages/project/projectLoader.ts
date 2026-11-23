import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectLoaderQuery } from "./__generated__/projectLoaderQuery.graphql";

/** The breadcrumb for a project whose name is not known. */
export const PROJECT_CRUMB_FALLBACK = "project";

export type ProjectLoaderData = ReturnType<typeof projectLoader>;

/**
 * Starts loading the project's name for the breadcrumb.
 *
 * Nothing here is awaited, so the router commits the navigation at once and
 * the project page renders its tabs while its own queries are in flight. The
 * name is handed over as a promise the breadcrumb resolves on its own; it
 * never rejects, so a project that cannot be loaded gets the generic crumb.
 */
export function projectLoader(args: LoaderFunctionArgs): {
  projectId: string;
  projectName: Promise<string>;
} {
  const { projectId } = args.params;
  invariant(projectId, "projectId is required");
  const projectName = fetchQuery<projectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectLoaderQuery($id: ID!) {
        project: node(id: $id) {
          ... on Project {
            name
          }
        }
      }
    `,
    { id: projectId },
    { fetchPolicy: "store-or-network" }
  )
    .toPromise()
    .then(
      (data) => data?.project?.name || PROJECT_CRUMB_FALLBACK,
      () => PROJECT_CRUMB_FALLBACK
    );
  return { projectId, projectName };
}
