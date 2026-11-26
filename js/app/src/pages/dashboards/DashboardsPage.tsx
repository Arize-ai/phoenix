import { css } from "@emotion/react";
import { Suspense, useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Navigate,
  Outlet,
  useLoaderData,
  useNavigate,
  useParams,
} from "react-router";
import invariant from "tiny-invariant";

import { ErrorBoundary, Flex, Loading } from "@phoenix/components";
import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import {
  ConnectedTimeRangeControls,
  ConnectedTimeRangeSelector,
} from "@phoenix/components/datetime";
import { ProjectMenu } from "@phoenix/components/project";
import { usePreferencesContext } from "@phoenix/contexts";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";

import type { dashboardsLoaderQuery as DashboardsLoaderQuery } from "./__generated__/dashboardsLoaderQuery.graphql";
import type { DashboardsPageLastSelectedProjectQuery } from "./__generated__/DashboardsPageLastSelectedProjectQuery.graphql";
import type { DashboardsLoaderData } from "./dashboardsLoader";
import { dashboardsLoaderQuery } from "./dashboardsLoader";

const dashboardsPageCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

const toolbarCSS = css`
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
  border-bottom: 1px solid var(--global-border-color-default);
`;

const projectMenuCSS = css`
  flex: 0 1 320px;
  min-width: 220px;
  max-width: 360px;
  width: 100%;
`;

const contentCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

export function DashboardsPage() {
  const loaderData = useLoaderData<DashboardsLoaderData>();
  invariant(loaderData, "loaderData is required");
  const navigate = useNavigate();
  const { projectId } = useParams();
  const setLastSelectedDashboardProjectId = usePreferencesContext(
    (state) => state.setLastSelectedDashboardProjectId
  );
  const data = useOwnedPreloadedQuery<DashboardsLoaderQuery>({
    query: dashboardsLoaderQuery,
    queryRef: loaderData.queryRef,
  });

  return (
    <div css={dashboardsPageCSS}>
      <div css={toolbarCSS}>
        <ProjectMenu
          css={projectMenuCSS}
          query={data}
          selectedProjectId={projectId}
          size="S"
          onProjectChange={(projectId) => {
            setLastSelectedDashboardProjectId(projectId);
            navigate(`/dashboards/projects/${projectId}`);
          }}
        />
        <Flex direction="row" alignItems="center" gap="size-100">
          <ConnectedTimeRangeSelector size="S" />
          <ConnectedTimeRangeControls size="S" />
        </Flex>
      </div>
      <div css={contentCSS}>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

export function DashboardsEmptyPage() {
  const lastSelectedDashboardProjectId = usePreferencesContext(
    (state) => state.lastSelectedDashboardProjectId
  );
  if (lastSelectedDashboardProjectId) {
    return (
      <ErrorBoundary fallback={ForgetLastSelectedProject}>
        <Suspense fallback={<Loading />}>
          <LastSelectedProjectRedirect
            projectId={lastSelectedDashboardProjectId}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }
  return <NoProjectSelected />;
}

/**
 * Returns to the project last selected on the dashboards page. The project is
 * looked up first because it may have been deleted since it was selected, in
 * which case the lookup fails and the boundary above forgets it rather than
 * redirecting to a page that cannot load.
 */
function LastSelectedProjectRedirect({ projectId }: { projectId: string }) {
  useLazyLoadQuery<DashboardsPageLastSelectedProjectQuery>(
    graphql`
      query DashboardsPageLastSelectedProjectQuery($id: ID!) {
        node(id: $id) {
          __typename
          ... on Project {
            name
          }
        }
      }
    `,
    { id: projectId },
    { fetchPolicy: "network-only" }
  );
  return <Navigate to={`/dashboards/projects/${projectId}`} replace />;
}

function ForgetLastSelectedProject() {
  const setLastSelectedDashboardProjectId = usePreferencesContext(
    (state) => state.setLastSelectedDashboardProjectId
  );
  useEffect(() => {
    setLastSelectedDashboardProjectId(undefined);
  }, [setLastSelectedDashboardProjectId]);
  return <NoProjectSelected />;
}

function NoProjectSelected() {
  return (
    <EmptyStateArea>
      <EmptyState
        graphic={<EmptyStateGraphic variant="project" />}
        title="No project selected"
        description="Select a project to view its dashboards."
      />
    </EmptyStateArea>
  );
}
