import { css } from "@emotion/react";
import { Suspense } from "react";
import { Outlet, useMatch, useNavigate } from "react-router";

import { LazyTabPanel, Tab, TabList, Tabs } from "@phoenix/components";
import { TableSkeleton } from "@phoenix/components/table";

const mainCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .tabs {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    div[role="tablist"] {
      flex: none;
    }
    .tabs__pane-container {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      div[role="tabpanel"]:not([hidden]) {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
    }
  }
`;

const TAB_PATHS = {
  "project-evaluators": "/evaluators/project-evaluators",
  "dataset-evaluators": "/evaluators/dataset-evaluators",
  all: "/evaluators/all",
} as const;
type TabName = keyof typeof TAB_PATHS;

function isTabName(name: unknown): name is TabName {
  return typeof name === "string" && name in TAB_PATHS;
}

/**
 * The Evaluators page's tabs: every project evaluator running online across
 * all projects, every dataset evaluator across all datasets, and both in one
 * list.
 */
export function EvaluatorsLayout() {
  const navigate = useNavigate();
  const isDatasetEvaluatorsTab =
    useMatch(TAB_PATHS["dataset-evaluators"]) != null;
  const isAllTab = useMatch(TAB_PATHS.all) != null;
  const selectedTab: TabName = isDatasetEvaluatorsTab
    ? "dataset-evaluators"
    : isAllTab
      ? "all"
      : "project-evaluators";
  return (
    <main css={mainCSS}>
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => {
          if (isTabName(key) && key !== selectedTab) {
            navigate(TAB_PATHS[key]);
          }
        }}
      >
        <TabList>
          <Tab id="project-evaluators">Project evaluators</Tab>
          <Tab id="dataset-evaluators">Dataset evaluators</Tab>
          <Tab id="all">All</Tab>
        </TabList>
        <LazyTabPanel id="project-evaluators">
          <Suspense fallback={<TableSkeleton hasToolbar rowCount="fill" />}>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="dataset-evaluators">
          <Suspense fallback={<TableSkeleton hasToolbar rowCount="fill" />}>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="all">
          <Suspense fallback={<TableSkeleton hasToolbar rowCount="fill" />}>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}
