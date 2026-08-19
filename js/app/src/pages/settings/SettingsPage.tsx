import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Key } from "react-aria-components";
import { Collection } from "react-aria-components";
import { Navigate, Outlet, useMatch, useNavigate } from "react-router";

import {
  Icon,
  Icons,
  Loading,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@phoenix/components";
import { PxiGlyphOutline } from "@phoenix/components/agent";
import { McpSVG } from "@phoenix/components/project/IntegrationIcons";
import {
  useIsAuthenticatedAdmin,
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

const tabLabelCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
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
    // The panel is a flex column; without this, content taller than the
    // viewport flex-shrinks to the panel height and clips itself.
    flex: none;
  }
`;

// Icons follow the associations established elsewhere in the app (side nav,
// session tabs): Database for datasets, MessageSquare for prompts, Edit2 for
// annotations, and the PXI glyph for the assistant.
const TABS = [
  { id: "general", label: "General", icon: <Icons.Settings /> },
  { id: "users", label: "Users", icon: <Icons.Person /> },
  { id: "api-keys", label: "API Keys", icon: <Icons.Key /> },
  { id: "providers", label: "AI Providers", icon: <Icons.Sparkle /> },
  { id: "sandboxes", label: "Sandboxes", icon: <Icons.Console /> },
  { id: "models", label: "Models", icon: <Icons.Cube /> },
  { id: "secrets", label: "Secrets", icon: <Icons.Lock /> },
  { id: "datasets", label: "Datasets", icon: <Icons.Database /> },
  { id: "annotations", label: "Annotations", icon: <Icons.Edit2 /> },
  { id: "prompts", label: "Prompts", icon: <Icons.MessageSquare /> },
  { id: "data", label: "Data Retention", icon: <Icons.HardDrive /> },
  { id: "agents", label: "Assistant", icon: <PxiGlyphOutline /> },
  { id: "mcp", label: "MCP", icon: <McpSVG /> },
] as const satisfies readonly { id: string; label: string; icon: ReactNode }[];

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
  const isAuthenticatedAdmin = useIsAuthenticatedAdmin();
  const canManageSecrets = useViewerCanManageSecrets();
  const canManageSandboxes = useViewerCanManageSandboxes();
  // Tabs absent from this map are visible to everyone.
  const tabVisibility: Partial<Record<SettingsTabId, boolean>> = {
    agents: !window.Config.agentAssistantDisabled,
    users: isAuthenticatedAdmin,
    "api-keys": isAuthenticatedAdmin,
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
          {(item) => (
            <Tab id={item.id}>
              <span css={tabLabelCSS}>
                <Icon svg={item.icon} />
                {item.label}
              </span>
            </Tab>
          )}
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
