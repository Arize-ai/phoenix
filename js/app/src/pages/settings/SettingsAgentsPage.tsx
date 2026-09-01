import { css } from "@emotion/react";
import { Suspense } from "react";
import type { Key } from "react-aria-components";
import { Outlet, useMatch, useNavigate } from "react-router";

import {
  DocumentationHelp,
  Flex,
  Heading,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@phoenix/components";

import {
  isSettingsAgentsTabId,
  SETTINGS_AGENTS_TABS,
  settingsAgentsTabPath,
} from "./SettingsAgentsShared";

const pageCSS = css`
  max-width: 900px;
`;

/**
 * Shell of the assistant settings page: the tab list plus an outlet for the
 * nested tab routes. Each tab's content is its own route under
 * /settings/agents (see {@link SETTINGS_AGENTS_TABS}).
 */
export function SettingsAgentsPage() {
  const tabParam = useMatch("/settings/agents/:tab")?.params.tab;
  const navigate = useNavigate();
  const selectedTab = isSettingsAgentsTabId(tabParam) ? tabParam : "general";
  const onSelectionChange = (key: Key) => {
    if (
      typeof key !== "string" ||
      !isSettingsAgentsTabId(key) ||
      key === selectedTab
    ) {
      return;
    }
    navigate(settingsAgentsTabPath(key));
  };
  return (
    <div css={pageCSS}>
      <Flex direction="column" gap="size-200">
        <Flex direction="row" alignItems="center" gap="size-100">
          <Heading level={2} weight="heavy">
            Assistant settings - PXI
          </Heading>
          <DocumentationHelp topic="pxi">
            Configure Phoenix Intelligence and personal assistant preferences.
          </DocumentationHelp>
        </Flex>
        <Tabs selectedKey={selectedTab} onSelectionChange={onSelectionChange}>
          <TabList aria-label="Assistant settings">
            {SETTINGS_AGENTS_TABS.map((tab) => (
              <Tab key={tab.id} id={tab.id}>
                {tab.label}
              </Tab>
            ))}
          </TabList>
          {/* The router already resolves which tab's content the outlet
              renders, so one panel keyed to the selected tab suffices. */}
          <TabPanel id={selectedTab} padded>
            <Suspense>
              <Outlet />
            </Suspense>
          </TabPanel>
        </Tabs>
      </Flex>
    </div>
  );
}
