import { css } from "@emotion/react";
import { Suspense } from "react";
import type { Key } from "react-aria-components";
import { Collection } from "react-aria-components";
import { Navigate, Outlet, useMatch, useNavigate } from "react-router";

import { Loading, Tab, TabList, TabPanel, Tabs } from "@phoenix/components";
import {
  useIsAdmin,
  useViewerCanManageSandboxes,
  useViewerCanManageSecrets,
} from "@phoenix/contexts";
import { useMediaQuery } from "@phoenix/hooks";

/**
 * Below this width the vertical tab rail would squeeze the settings content
 * (tables, cards) too much, so the tabs fall back to a horizontal,
 * scrollable bar above the content.
 */
const VERTICAL_TABS_MEDIA_QUERY = "(min-width: 900px)";

const settingsPageCSS = css`
  overflow: hidden;
  height: 100%;
`;

const settingsTabListCSS = css`
  &[data-orientation="vertical"] {
    flex: none;
    width: var(--global-dimension-size-2400);
    box-sizing: border-box;
    // The rail scrolls on its own if the tab list ever outgrows the
    // viewport; it never scrolls along with the content.
    overflow-y: auto;
    padding: var(--global-dimension-size-200) var(--global-dimension-size-100);
  }
  &[data-orientation="horizontal"] {
    margin: 0 var(--global-dimension-size-200);
  }
`;

// The panel is the scroll container and stretches to the viewport edge so
// its scrollbar sits at the edge of the screen, not in the middle of the
// page. Padding lives inside the scroll area, and the content is capped and
// left-aligned against the rail.
const settingsTabPanelCSS = css`
  overflow-y: auto;
  padding: var(--global-dimension-size-200) var(--global-dimension-size-300)
    var(--global-dimension-size-300);
  & > * {
    max-width: 1200px;
  }
`;

const TABS = [
  { id: "general", label: "General" },
  { id: "users", label: "Users" },
  { id: "api-keys", label: "API Keys" },
  { id: "providers", label: "AI Providers" },
  { id: "sandboxes", label: "Sandboxes" },
  { id: "models", label: "Models" },
  { id: "secrets", label: "Secrets" },
  { id: "datasets", label: "Datasets" },
  { id: "annotations", label: "Annotations" },
  { id: "prompts", label: "Prompts" },
  { id: "data", label: "Data Retention" },
  { id: "agents", label: "Assistant" },
] as const satisfies readonly { id: string; label: string }[];

type SettingsTabId = (typeof TABS)[number]["id"];

function isSettingsTabId(value: string | undefined): value is SettingsTabId {
  return TABS.some((tab) => tab.id === value);
}

export function SettingsPage() {
  const navigate = useNavigate();
  const isLargeScreen = useMediaQuery(VERTICAL_TABS_MEDIA_QUERY);
  // Matches nested routes (e.g. /settings/users/:userId) so the tab stays
  // selected while a child route like the user details drawer is open.
  const tab = useMatch("/settings/:tab/*")?.params.tab;
  const onChangeTab = (tab: Key) => {
    if (typeof tab === "string") {
      navigate(`/settings/${tab}`, { replace: true });
    }
  };
  const isAdmin = useIsAdmin();
  const canManageSecrets = useViewerCanManageSecrets();
  const canManageSandboxes = useViewerCanManageSandboxes();
  // Tabs absent from this map are visible to everyone.
  const tabVisibility: Partial<Record<SettingsTabId, boolean>> = {
    agents: !window.Config.agentAssistantDisabled,
    users: isAdmin,
    "api-keys": isAdmin,
    secrets: canManageSecrets,
    sandboxes: canManageSandboxes,
  };
  const tabs = TABS.filter((tab) => tabVisibility[tab.id] ?? true);
  if (!isSettingsTabId(tab) || !tabs.some((item) => item.id === tab)) {
    return <Navigate to="/settings/general" replace />;
  }
  return (
    <main css={settingsPageCSS}>
      <Tabs
        selectedKey={tab}
        onSelectionChange={onChangeTab}
        orientation={isLargeScreen ? "vertical" : "horizontal"}
      >
        <TabList items={tabs} css={settingsTabListCSS} aria-label="Settings">
          {(item) => <Tab id={item.id}>{item.label}</Tab>}
        </TabList>
        <Collection items={tabs}>
          {(item) => (
            <TabPanel id={item.id} css={settingsTabPanelCSS}>
              <Suspense fallback={<Loading />}>
                <Outlet />
              </Suspense>
            </TabPanel>
          )}
        </Collection>
      </Tabs>
    </main>
  );
}
