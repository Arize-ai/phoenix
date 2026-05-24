import { css } from "@emotion/react";
import { Suspense } from "react";
import { Navigate, Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Empty, Flex, Loading } from "@phoenix/components";
import { ConnectedTimeRangeSelector } from "@phoenix/components/datetime";
import { usePreferencesContext } from "@phoenix/contexts";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";

import type { dashboardsLoaderQuery as DashboardsLoaderQuery } from "./__generated__/dashboardsLoaderQuery.graphql";
import type { DashboardsLoaderData } from "./dashboardsLoader";
import { dashboardsLoaderQuery } from "./dashboardsLoader";
import { ProjectSelector } from "./ProjectSelector";

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

const contentCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

export function DashboardsPage() {
  const loaderData = useLoaderData<DashboardsLoaderData>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery<DashboardsLoaderQuery>({
    query: dashboardsLoaderQuery,
    queryRef: loaderData.queryRef,
  });

  return (
    <div css={dashboardsPageCSS}>
      <div css={toolbarCSS}>
        <ProjectSelector query={data} />
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
