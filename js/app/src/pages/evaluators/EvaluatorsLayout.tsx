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

const PROJECT_EVALUATORS_PATH = "/evaluators/project-evaluators";
const DATASET_EVALUATORS_PATH = "/evaluators/dataset-evaluators";

const TABS = [
  "evaluators",
  "project-evaluators",
  "dataset-evaluators",
] as const;
type TabName = (typeof TABS)[number];

const TAB_PATHS: Record<TabName, string> = {
  evaluators: "/evaluators",
  "project-evaluators": PROJECT_EVALUATORS_PATH,
  "dataset-evaluators": DATASET_EVALUATORS_PATH,
};

function isTabName(name: unknown): name is TabName {
  return typeof name === "string" && (TABS as readonly string[]).includes(name);
}

/**
 * The Evaluators page's tabs: the evaluator library, every project evaluator
 * running online across all projects, and every dataset evaluator across all
 * datasets.
 */
export function EvaluatorsLayout() {
  const navigate = useNavigate();
  const isProjectEvaluatorsTab = useMatch(PROJECT_EVALUATORS_PATH) != null;
  const isDatasetEvaluatorsTab = useMatch(DATASET_EVALUATORS_PATH) != null;
  const selectedTab: TabName = isProjectEvaluatorsTab
    ? "project-evaluators"
    : isDatasetEvaluatorsTab
      ? "dataset-evaluators"
      : "evaluators";
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
          <Tab id="evaluators">All</Tab>
          <Tab id="project-evaluators">Project evaluators</Tab>
          <Tab id="dataset-evaluators">Dataset evaluators</Tab>
        </TabList>
        <LazyTabPanel id="evaluators">
          <Suspense fallback={<TableSkeleton hasToolbar rowCount="fill" />}>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
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
      </Tabs>
    </main>
  );
}
