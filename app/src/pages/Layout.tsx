import { css } from "@emotion/react";
import { Suspense, useCallback } from "react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";
import { Outlet, useLoaderData } from "react-router";

import { Counter, Flex, Icon, Icons, Loading } from "@phoenix/components";
import { AgentChatPanel } from "@phoenix/components/agent";
import {
  Brand,
  DocsLink,
  GitHubLink,
  ManagementLink,
  NavBreadcrumb,
  NavButton,
  NavLink,
  NavTitle,
  SideNavbar,
  SideNavToggleButton,
  ThemeSelector,
  TopNavbar,
} from "@phoenix/components/nav";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { LayoutLoaderData } from "./layoutLoader";

const layoutCSS = css`
  display: flex;
  direction: row;
  height: 100vh;
  overflow: hidden;
`;

const mainViewCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
  overflow: hidden;
`;
const contentCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  border-left: 1px solid var(--global-border-color-default);
  border-top: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium) 0 0 0;
  /* Fill the background of the content */
  box-shadow: 0 0 10px 10px var(--global-color-gray-100);
`;

const bottomLinksCSS = css`
  display: flex;
  flex-direction: column;
  margin: 0;
  list-style: none;
  gap: var(--global-dimension-size-50);
  padding-inline-start: 0;
`;

const sideLinksCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
`;

export function Layout() {
  const isAgentsEnabled = useFeatureFlag("agents");
  const isAgentPanelOpen = useAgentContext((state) => state.isOpen);
  const panelIds =
    isAgentsEnabled && isAgentPanelOpen
      ? ["layout-content", "agent-chat"]
      : ["layout-content"];
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "layout-panels",
    panelIds,
    storage: localStorage,
  });

  return (
    <div css={layoutCSS} data-testid="layout">
      <NavTitle />
      <SideNav />
      <div css={mainViewCSS}>
        <TopNavbar>
          <SideNavToggleButton />
          <NavBreadcrumb />
        </TopNavbar>
        <Group
          id="layout-panels"
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel id="layout-content">
            <div data-testid="content" css={contentCSS}>
              <Suspense fallback={<Loading />}>
                <Outlet />
              </Suspense>
            </div>
          </Panel>
          <AgentChatPanel />
        </Group>
      </div>
    </div>
  );
}

function SideNav() {
  const isSideNavExpanded = usePreferencesContext(
    (state) => state.isSideNavExpanded
  );
  const loaderData = useLoaderData<LayoutLoaderData>();
  const { authenticationEnabled } = useFunctionality();
  const onLogout = useCallback(() => {
    window.location.replace(prependBasename("/auth/logout"));
  }, []);
  return (
    <SideNavbar isExpanded={isSideNavExpanded}>
      <Brand />
      <Flex direction="column" justifyContent="space-between" flex="1 1 auto">
        <ul css={sideLinksCSS}>
          <li>
            <NavLink
              to="/projects"
              text="Tracing"
              leadingVisual={<Icon svg={<Icons.Trace />} />}
              trailingVisual={
                loaderData?.projectCount != null ? (
                  <Counter variant="quiet">{loaderData.projectCount}</Counter>
                ) : undefined
              }
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="datasets">
            <NavLink
              to="/datasets"
              text="Datasets & Experiments"
              leadingVisual={<Icon svg={<Icons.DatabaseOutline />} />}
              trailingVisual={
                loaderData?.datasetCount != null ? (
                  <Counter variant="quiet">{loaderData.datasetCount}</Counter>
                ) : undefined
              }
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="playground">
            <NavLink
              to="/playground"
              text="Playground"
              leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="evaluators">
            <NavLink
              to="/evaluators"
              text="Evaluators"
              leadingVisual={<Icon svg={<Icons.Scale />} />}
              trailingVisual={
                loaderData?.evaluatorCount != null ? (
                  <Counter variant="quiet">{loaderData.evaluatorCount}</Counter>
                ) : undefined
              }
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="prompts">
            <NavLink
              to="/prompts"
              text="Prompts"
              leadingVisual={<Icon svg={<Icons.MessageSquareOutline />} />}
              trailingVisual={
                loaderData?.promptCount != null ? (
                  <Counter variant="quiet">{loaderData.promptCount}</Counter>
                ) : undefined
              }
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="rest-api">
            <NavLink
              to="/apis/rest"
              text="REST API"
              leadingVisual={<Icon svg={<Icons.Code />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="graphql">
            <NavLink
              to="/apis/graphql"
              text="GraphQL"
              leadingVisual={<Icon svg={<Icons.GraphQL />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
        </ul>
        <ul css={bottomLinksCSS}>
          <li key="github">
            <GitHubLink isExpanded={isSideNavExpanded} />
          </li>
          <li key="settings">
            <NavLink
              to="/settings/general"
              text="Settings"
              leadingVisual={<Icon svg={<Icons.SettingsOutline />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="docs">
            <DocsLink isExpanded={isSideNavExpanded} />
          </li>
          <li key="support">
            <NavLink
              to="/support"
              text="Support"
              leadingVisual={<Icon svg={<Icons.LifeBuoy />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="theme-toggle">
            <ThemeSelector isExpanded={isSideNavExpanded} />
          </li>
          <li key="profile">
            <NavLink
              to="/profile"
              text="Profile"
              leadingVisual={<Icon svg={<Icons.PersonOutline />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
          {authenticationEnabled && (
            <>
              <Suspense>
                <ManagementLink isExpanded={isSideNavExpanded} />
              </Suspense>
              <li key="logout">
                <NavButton
                  text="Log Out"
                  leadingVisual={<Icon svg={<Icons.LogOut />} />}
                  onClick={onLogout}
                />
              </li>
            </>
          )}
        </ul>
      </Flex>
    </SideNavbar>
  );
}
