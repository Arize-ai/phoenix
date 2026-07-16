import { css } from "@emotion/react";
import { Suspense } from "react";
import type { Key } from "react-aria-components";
import { Collection } from "react-aria-components";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";

import { Loading, Tab, TabList, TabPanel, Tabs } from "@phoenix/components";
import { useViewerCanManageSandboxes } from "@phoenix/contexts";
import { useMediaQuery } from "@phoenix/hooks";

/**
 * Below this width the vertical tab rail would squeeze the settings content
 * (tables, cards) too much, so the tabs fall back to a horizontal,
 * scrollable bar above the content.
 */
const VERTICAL_TABS_MEDIA_QUERY = "(min-width: 900px)";

const settingsPageCSS = css`
  overflow-y: auto;
  height: 100%;
`;

const settingsPageInnerCSS = css`
  padding: var(--global-dimension-size-100);
  max-width: 1300px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

const settingsTabListCSS = css`
  &[data-orientation="vertical"] {
    flex: none;
    width: var(--global-dimension-size-2000);
    // Keep the rail in view while the settings content scrolls.
    position: sticky;
    top: 0;
    align-self: flex-start;
  }
`;

const TABS: { id: string; label: string }[] = [
  { id: "general", label: "General" },
  { id: "providers", label: "AI Providers" },
  { id: "sandboxes", label: "Sandboxes" },
  { id: "models", label: "Models" },
  { id: "secrets", label: "Secrets" },
  { id: "datasets", label: "Datasets" },
  { id: "annotations", label: "Annotations" },
  { id: "prompts", label: "Prompts" },
  { id: "data", label: "Data Retention" },
  { id: "agents", label: "Assistant" },
];

export function SettingsPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isLargeScreen = useMediaQuery(VERTICAL_TABS_MEDIA_QUERY);
  const tab = pathname.split("/settings")[1].replace("/", "");
  const onChangeTab = (tab: Key) => {
    if (typeof tab === "string") {
      navigate(`/settings/${tab}`, { replace: true });
    }
  };
  const isAgentAssistantEnabled = !window.Config.agentAssistantDisabled;
  const canManageSecrets = useViewerCanManageSandboxes();
  const canManageSandboxes = useViewerCanManageSandboxes();
  const tabs = TABS.filter((tab) => {
    if (tab.id === "agents" && !isAgentAssistantEnabled) {
      return false;
    }
    if (tab.id === "secrets" && !canManageSecrets) {
      return false;
    }
    if (tab.id === "sandboxes" && !canManageSandboxes) {
      return false;
    }
    return true;
  });
  if (!tab) {
    return <Navigate to="/settings/general" replace />;
  }
  if (!tabs.some((item) => item.id === tab)) {
    return <Navigate to="/settings/general" replace />;
  }
  return (
    <main css={settingsPageCSS}>
      <div css={settingsPageInnerCSS}>
        <Tabs
          selectedKey={tab}
          onSelectionChange={onChangeTab}
          orientation={isLargeScreen ? "vertical" : "horizontal"}
        >
          {/* TODO: filter sandboxes tab for non-admins */}
          <TabList items={tabs} css={settingsTabListCSS} aria-label="Settings">
            {(item) => <Tab id={item.id}>{item.label}</Tab>}
          </TabList>
          <Collection items={tabs}>
            {(item) => (
              <TabPanel id={item.id} padded>
                <Suspense fallback={<Loading />}>
                  <Outlet />
                </Suspense>
              </TabPanel>
            )}
          </Collection>
        </Tabs>
      </div>
    </main>
  );
}
