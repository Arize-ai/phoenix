import { css } from "@emotion/react";
import { Suspense } from "react";
import {
  Navigate,
  Outlet,
  useLoaderData,
  useNavigate,
  useParams,
} from "react-router";
import invariant from "tiny-invariant";

import { Empty, Flex, Loading } from "@phoenix/components";
import { ConnectedTimeRangeSelector } from "@phoenix/components/datetime";
import { ProjectMenu } from "@phoenix/components/project";
import { usePreferencesContext } from "@phoenix/contexts";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";

import type { dashboardsLoaderQuery as DashboardsLoaderQuery } from "./__generated__/dashboardsLoaderQuery.graphql";
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
  background-color: var(--global-color-gray-50);
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
        <ConnectedTimeRangeSelector size="S" />
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
      <Navigate
        to={`/dashboards/projects/${lastSelectedDashboardProjectId}`}
        replace
      />
    );
  }
  return (
    <Flex height="100%" alignItems="center" justifyContent="center">
      <Empty message="No project selected" />
    </Flex>
  );
}
