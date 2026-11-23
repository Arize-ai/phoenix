import { fetchQuery, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { ProjectPageQueriesOnboardingQuery as ProjectPageOnboardingQueryType } from "./__generated__/ProjectPageQueriesOnboardingQuery.graphql";
import { ProjectPageQueriesOnboardingQuery } from "./ProjectPageQueries";

/** The breadcrumb for a project whose name is not known. */
export const PROJECT_CRUMB_FALLBACK = "project";

export type ProjectLoaderData = ReturnType<typeof projectLoader>;

/**
 * The project's name when the store already holds its record, say from the
 * projects list. Read from the record itself: a store lookup of the onboarding
 * query would also need `hasTraces`, which the projects list does not load.
 */
function readStoredProjectName(projectId: string): string | null {
  const projectName = RelayEnvironment.getStore()
    .getSource()
    .get(projectId)?.name;
  return typeof projectName === "string" && projectName ? projectName : null;
}

/**
 * Starts loading the project's onboarding state and its name.
 *
 * Nothing here is awaited, so the router commits the navigation at once and
 * the project page renders its tabs while its queries are in flight.
 * `ProjectRoot` owns the query ref. The breadcrumb's name is the stored one
 * when the store has it, and otherwise a promise that shares the ref's
 * request; it never rejects, so a project that cannot be loaded gets the
 * generic crumb.
 */
export function projectLoader(args: LoaderFunctionArgs): {
  projectId: string;
  projectName: string | Promise<string>;
  onboardingQueryReference: ReturnType<
    typeof loadQuery<ProjectPageOnboardingQueryType>
  >;
} {
  const { projectId } = args.params;
  invariant(projectId, "projectId is required");
  const variables = { id: projectId };
  const onboardingQueryReference = loadQuery<ProjectPageOnboardingQueryType>(
    RelayEnvironment,
    ProjectPageQueriesOnboardingQuery,
    variables,
    { fetchPolicy: "network-only" }
  );
  const projectName =
    readStoredProjectName(projectId) ??
    fetchQuery<ProjectPageOnboardingQueryType>(
      RelayEnvironment,
      ProjectPageQueriesOnboardingQuery,
      variables,
      { fetchPolicy: "store-or-network" }
    )
      .toPromise()
      .then(
        (data) => data?.project?.name || PROJECT_CRUMB_FALLBACK,
        () => PROJECT_CRUMB_FALLBACK
      );
  return { projectId, projectName, onboardingQueryReference };
}
