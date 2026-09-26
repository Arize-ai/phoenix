import { type ReactNode, startTransition } from "react";
import { useLocation, useNavigate } from "react-router";

import { Tab, TabList, Tabs } from "@phoenix/components/core/tabs";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

const TABS = ["spans", "traces", "sessions", "config", "metrics"] as const;

export type ProjectTab = (typeof TABS)[number];

/**
 * Type guard for the tab path in the URL
 */
export const isTab = (tab: string): tab is ProjectTab => {
  return TABS.includes(tab as ProjectTab);
};

/**
 * The project page tab bar. The selected tab comes from the URL; switching
 * tabs keeps the time range, filters and hash but drops the selected
 * trace/span.
 */
export function ProjectTabs({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const { rootPath, tab } = useProjectRootPath();
  const { search, hash } = useLocation();
  const tabPath = (id: ProjectTab) =>
    `${rootPath}/${id}${clearSelectionScopedParams(search)}${hash}`;
  return (
    <Tabs
      onSelectionChange={(key) => {
        if (typeof key === "string" && isTab(key)) {
          startTransition(() => {
            navigate(tabPath(key));
          });
        }
      }}
      selectedKey={tab}
    >
      <TabList>
        <Tab id="spans">Spans</Tab>
        <Tab id="traces">Traces</Tab>
        <Tab id="sessions">Sessions</Tab>
        <Tab id="metrics">Metrics</Tab>
        <Tab id="config">Config</Tab>
      </TabList>
      {children}
    </Tabs>
  );
}
