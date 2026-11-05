import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet, useMatch, useNavigate } from "react-router";

import { Counter, LazyTabPanel, Tab, TabList, Tabs } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import type { EvaluatorsLayoutCountsQuery } from "@phoenix/pages/evaluators/__generated__/EvaluatorsLayoutCountsQuery.graphql";
import { AllEvaluatorsTabSkeleton } from "@phoenix/pages/evaluators/all/AllEvaluatorsTab";
import { DatasetEvaluatorsTabSkeleton } from "@phoenix/pages/evaluators/dataset-evaluators/DatasetEvaluatorsTab";
import { ProjectEvaluatorsTabSkeleton } from "@phoenix/pages/evaluators/project-evaluators/ProjectEvaluatorsTab";

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

const tabCountSkeletonCSS = css`
  display: inline-block;
  vertical-align: middle;
`;

/** A tab's count while it loads, in the space a one-digit count takes. */
function TabCountSkeleton() {
  return (
    <Skeleton
      css={tabCountSkeletonCSS}
      width="calc(var(--global-dimension-size-150) + 2 * var(--global-dimension-size-50))"
      height="var(--global-line-height-xs)"
    />
  );
}

/**
 * How many evaluators a tab lists. Fetched on every visit, since evaluators
 * are created and deleted on project and dataset pages.
 */
function TabCount({ tab }: { tab: TabName }) {
  const { projectEvaluatorCount, datasetEvaluatorCount } =
    useLazyLoadQuery<EvaluatorsLayoutCountsQuery>(
      graphql`
        query EvaluatorsLayoutCountsQuery {
          projectEvaluatorCount
          datasetEvaluatorCount
        }
      `,
      {},
      { fetchPolicy: "store-and-network" }
    );
  const count =
    tab === "project-evaluators"
      ? projectEvaluatorCount
      : tab === "dataset-evaluators"
        ? datasetEvaluatorCount
        : projectEvaluatorCount + datasetEvaluatorCount;
  return <Counter variant="quiet">{count}</Counter>;
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
          <Tab id="project-evaluators">
            Project evaluators{" "}
            <Suspense fallback={<TabCountSkeleton />}>
              <TabCount tab="project-evaluators" />
            </Suspense>
          </Tab>
          <Tab id="dataset-evaluators">
            Dataset evaluators{" "}
            <Suspense fallback={<TabCountSkeleton />}>
              <TabCount tab="dataset-evaluators" />
            </Suspense>
          </Tab>
          <Tab id="all">
            All evaluators{" "}
            <Suspense fallback={<TabCountSkeleton />}>
              <TabCount tab="all" />
            </Suspense>
          </Tab>
        </TabList>
        <LazyTabPanel id="project-evaluators">
          <Suspense fallback={<ProjectEvaluatorsTabSkeleton />}>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="dataset-evaluators">
          <Suspense fallback={<DatasetEvaluatorsTabSkeleton />}>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="all">
          <Suspense fallback={<AllEvaluatorsTabSkeleton />}>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}
