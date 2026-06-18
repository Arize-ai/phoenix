import { css } from "@emotion/react";
import { Suspense, useCallback, useRef } from "react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";
import { Outlet, useLoaderData } from "react-router";

import { Counter, Flex, Icon, Icons, Loading } from "@phoenix/components";
import {
  AgentChatPanel,
  AgentChatWidget,
  FloatingAgentChatPanel,
  useAssistantAgentEnabled,
} from "@phoenix/components/agent";
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
  TopNavActionsProvider,
  TopNavActionsSlot,
  TopNavbar,
} from "@phoenix/components/nav";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import {
  useHasOpenDrawer,
  useHasOpenModal,
} from "@phoenix/hooks/useHasOpenModal";
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
  min-width: 0;
  height: 100%;
  overflow: hidden;
`;

const layoutContentPanelCSS = css`
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
`;

const contentCSS = css`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  background-color: var(--global-color-gray-75);
  border-left: 1px solid var(--global-border-color-default);
  border-top: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium) 0 0 0;
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
  const contentRef = useRef<HTMLDivElement>(null);
  const isAgentAssistantEnabled = useAssistantAgentEnabled();
  const isAgentPanelOpen = useAgentContext((state) => state.isOpen);
  const agentPosition = useAgentContext((state) => state.position);
  const hasOpenModal = useHasOpenModal();
  const hasOpenDrawer = useHasOpenDrawer();
  const shouldForceFloatingAgentPanel = hasOpenModal || hasOpenDrawer;
  const shouldShowDockedAgentPanel =
    isAgentAssistantEnabled &&
    isAgentPanelOpen &&
    agentPosition === "pinned" &&
    !shouldForceFloatingAgentPanel;
  const shouldShowFloatingAgentPanel =
    isAgentAssistantEnabled &&
    isAgentPanelOpen &&
    (agentPosition === "detached" || shouldForceFloatingAgentPanel);
  const panelIds = shouldShowDockedAgentPanel
    ? ["layout-content", "agent-chat"]
    : ["layout-content"];
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "layout-panels",
    panelIds,
    storage: localStorage,
  });

  return (
    <TopNavActionsProvider>
      <div css={layoutCSS} data-testid="layout">
        <NavTitle />
        <SideNav />
        <div css={mainViewCSS}>
          <Group
            id="layout-panels"
            orientation="horizontal"
            defaultLayout={defaultLayout}
            onLayoutChanged={onLayoutChanged}
          >
            <Panel id="layout-content" css={layoutContentPanelCSS}>
              <TopNavbar>
                <SideNavToggleButton />
                <NavBreadcrumb />
                <TopNavActionsSlot />
              </TopNavbar>
              <div data-testid="content" css={contentCSS} ref={contentRef}>
                <AgentChatWidget boundaryRef={contentRef} />
                {shouldShowFloatingAgentPanel ? (
                  <FloatingAgentChatPanel
                    boundaryRef={contentRef}
                    isForcedFloating={shouldForceFloatingAgentPanel}
                    layer={hasOpenModal ? "modal" : "content"}
                  />
                ) : null}
                <Suspense fallback={<Loading />}>
                  <Outlet />
                </Suspense>
              </div>
            </Panel>
            {shouldShowDockedAgentPanel ? <AgentChatPanel /> : null}
          </Group>
        </div>
      </div>
    </TopNavActionsProvider>
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
          <li key="dashboards">
            <NavLink
              to="/dashboards"
              text="Dashboards"
              leadingVisual={<Icon svg={<Icons.GridOutline />} />}
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
