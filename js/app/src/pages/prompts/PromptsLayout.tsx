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

const TABS = ["prompts", "decisions"] as const;
type TabName = (typeof TABS)[number];

function isTabName(name: unknown): name is TabName {
  return typeof name === "string" && (TABS as readonly string[]).includes(name);
}

export function PromptsLayout() {
  const navigate = useNavigate();
  const isDecisionsTab = useMatch("/prompts/decisions") != null;
  const selectedTab: TabName = isDecisionsTab ? "decisions" : "prompts";
  return (
    <main css={mainCSS}>
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => {
          if (isTabName(key) && key !== selectedTab) {
            navigate(key === "decisions" ? "/prompts/decisions" : "/prompts");
          }
        }}
      >
        <TabList>
          <Tab id="prompts">Prompts</Tab>
          <Tab id="decisions">Decisions</Tab>
        </TabList>
        <LazyTabPanel id="prompts">
          <Suspense fallback={<TableSkeleton hasToolbar rowCount="fill" />}>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
        <LazyTabPanel id="decisions">
          <Suspense fallback={<TableSkeleton hasToolbar rowCount="fill" />}>
            <Outlet />
          </Suspense>
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}
