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
 * trace/span. Each tab is a link to that URL so mod/middle-click can open it
 * in a new browser tab.
 */
export function ProjectTabs({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const { rootPath, tab } = useProjectRootPath();
  const { search, hash } = useLocation();
  const tabPath = (id: ProjectTab) =>
    `${rootPath}/${id}${clearSelectionScopedParams(search)}${hash}`;
  // The selected tab stays a plain tab (no href): clicking it was a no-op, and
  // as a link it would navigate and close the selected trace/span.
  const tabHref = (id: ProjectTab) => (id === tab ? undefined : tabPath(id));
  return (
    <Tabs
      // Clicks follow the tab's link; arrow-key selection does not, so it
      // navigates here. A link press re-reports the current key, which must
      // not navigate or it would undo the link (or a mod-click) navigation.
      onSelectionChange={(key) => {
        if (typeof key === "string" && isTab(key) && key !== tab) {
          startTransition(() => {
            navigate(tabPath(key));
          });
        }
      }}
      selectedKey={tab}
    >
      <TabList>
        <Tab id="spans" href={tabHref("spans")}>
          Spans
        </Tab>
        <Tab id="traces" href={tabHref("traces")}>
          Traces
        </Tab>
        <Tab id="sessions" href={tabHref("sessions")}>
          Sessions
        </Tab>
        <Tab id="metrics" href={tabHref("metrics")}>
          Metrics
        </Tab>
        <Tab id="config" href={tabHref("config")}>
          Config
        </Tab>
      </TabList>
      {children}
    </Tabs>
  );
}
