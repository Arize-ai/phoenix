import type { ReactNode } from "react";
import type { PreloadedQuery } from "react-relay";
import { Outlet, useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { ProjectProvider } from "@phoenix/contexts/ProjectContext";
import { useOwnedQueryReference } from "@phoenix/hooks";

import type { ProjectPageQueriesOnboardingQuery as ProjectPageOnboardingQueryType } from "./__generated__/ProjectPageQueriesOnboardingQuery.graphql";
import type { ProjectLoaderData } from "./projectLoader";
import {
  ProjectOnboardingQueryReferenceContext,
  ProjectPageQueriesOnboardingQuery,
} from "./ProjectPageQueries";

export function ProjectRoot() {
  const { projectId } = useParams();
  invariant(projectId, "Project ID is required");
  const { onboardingQueryReference } = useLoaderData<ProjectLoaderData>();
  return (
    <ProjectProvider projectId={projectId}>
      {/* Keyed because the route stays mounted across projects, and the
          loader's ref for the next project must replace this one. */}
      <ProjectOnboardingQueryOwner
        key={projectId}
        queryReference={onboardingQueryReference}
      >
        <Outlet />
      </ProjectOnboardingQueryOwner>
    </ProjectProvider>
  );
}

function ProjectOnboardingQueryOwner({
  queryReference,
  children,
}: {
  queryReference: PreloadedQuery<ProjectPageOnboardingQueryType>;
  children: ReactNode;
}) {
  const ownedQueryReference =
    useOwnedQueryReference<ProjectPageOnboardingQueryType>({
      query: ProjectPageQueriesOnboardingQuery,
      queryRef: queryReference,
    });
  return (
    <ProjectOnboardingQueryReferenceContext.Provider
      value={ownedQueryReference}
    >
      {children}
    </ProjectOnboardingQueryReferenceContext.Provider>
  );
}
