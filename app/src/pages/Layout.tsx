import { css } from "@emotion/react";
import { Suspense, useRef } from "react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";
import { Outlet, useLoaderData } from "react-router";

import { Counter, Flex, Icon, Icons, Loading } from "@phoenix/components";
import {
  AgentChatPanel,
  AgentChatTopNavButton,
  AgentChatWidget,
  FloatingAgentChatPanel,
  useAssistantAgentEnabled,
} from "@phoenix/components/agent";
import {
  AppFrameOverlayProvider,
  useAppFrameOverlay,
} from "@phoenix/components/core/overlay";
import {
  AccountMenu,
  Brand,
  GitHubLink,
  NavBreadcrumb,
  NavLink,
  NavTitle,
  SideNavbar,
  SideNavToggleButton,
  TopNavActionsProvider,
  TopNavActionsSlot,
  TopNavbar,
  VersionUpdateNotice,
} from "@phoenix/components/nav";
import { GlobalSearch } from "@phoenix/components/search";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import type { LayoutLoaderData } from "./layoutLoader";

const layoutCSS = css`
  height: 100vh;
  width: 100vw;

  &[data-has-pinned-rail="false"] {
    min-width: 400px;
  }

  &[data-has-pinned-rail="true"] {
    min-width: 841px;
  }
`;

const applicationViewportCSS = css`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  height: 100%;
  overflow: hidden;
`;

const layoutContentPanelCSS = css`
  min-width: 0;
  overflow: hidden;
`;

const sideNavCellCSS = css`
  grid-column: 1;
  grid-row: 1 / 3;
  min-height: 0;
`;

const topNavCellCSS = css`
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
`;

const contentCSS = css`
  grid-column: 2;
  grid-row: 2;
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

const drawerHostCSS = css`
  grid-column: 1 / 3;
  grid-row: 2;
  position: relative;
  z-index: 100;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  pointer-events: none;
`;

const viewportModalHostCSS = css`
  grid-column: 1 / 3;
  grid-row: 1 / 3;
  position: relative;
  z-index: 200;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  pointer-events: none;
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
  return (
    <AppFrameOverlayProvider>
      <ApplicationFrame />
    </AppFrameOverlayProvider>
  );
}

function ApplicationFrame() {
  const contentRef = useRef<HTMLDivElement>(null);
  const appFrameOverlay = useAppFrameOverlay();
  const isAgentAssistantEnabled = useAssistantAgentEnabled();
  const isAgentPanelOpen = useAgentContext((state) => state.isOpen);
  const agentPosition = useAgentContext((state) => state.position);
  const isAgentFabFloating = useAgentContext(
    (state) => state.fabMode === "floating"
  );
  const shouldShowDockedAgentPanel =
    isAgentAssistantEnabled && isAgentPanelOpen && agentPosition === "pinned";
  const shouldShowFloatingAgentPanel =
    isAgentAssistantEnabled && isAgentPanelOpen && agentPosition === "detached";
  const panelIds = shouldShowDockedAgentPanel
    ? ["layout-content", "agent-chat"]
    : ["layout-content"];
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "application-frame-panels",
    panelIds,
    storage: localStorage,
  });

  return (
    <TopNavActionsProvider>
      <div
        data-testid="layout"
        data-has-pinned-rail={shouldShowDockedAgentPanel ? "true" : "false"}
        css={layoutCSS}
      >
        <NavTitle />
        <Group
          id="application-frame-panels"
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel
            id="layout-content"
            css={layoutContentPanelCSS}
            minSize="400px"
          >
            <div
              data-testid="application-viewport"
              css={applicationViewportCSS}
              ref={appFrameOverlay?.setApplicationViewportElement}
            >
              <div
                data-testid="application-side-navigation"
                css={sideNavCellCSS}
                inert={appFrameOverlay?.isViewportBlocked || undefined}
              >
                <SideNav />
              </div>
              <div
                data-testid="application-top-navigation"
                css={topNavCellCSS}
                inert={appFrameOverlay?.isViewportBlocked || undefined}
              >
                <TopNavbar>
                  <SideNavToggleButton />
                  <NavBreadcrumb />
                  <TopNavActionsSlot />
                  {isAgentFabFloating ? null : <AgentChatTopNavButton />}
                </TopNavbar>
              </div>
              <div
                data-testid="content"
                css={contentCSS}
                inert={appFrameOverlay?.isViewportBlocked || undefined}
                ref={contentRef}
              >
                {isAgentFabFloating ? (
                  <AgentChatWidget boundaryRef={contentRef} />
                ) : null}
                {shouldShowFloatingAgentPanel ? (
                  <FloatingAgentChatPanel boundaryRef={contentRef} />
                ) : null}
                <Suspense fallback={<Loading />}>
                  <Outlet />
                </Suspense>
              </div>
              <div
                data-testid="application-drawer-plane"
                css={drawerHostCSS}
                inert={appFrameOverlay?.isViewportBlocked || undefined}
                ref={appFrameOverlay?.setDrawerHostElement}
              />
              <div
                data-testid="application-viewport-modal-plane"
                css={viewportModalHostCSS}
                ref={appFrameOverlay?.setViewportModalHostElement}
              />
            </div>
          </Panel>
          {shouldShowDockedAgentPanel ? <AgentChatPanel /> : null}
        </Group>
      </div>
    </TopNavActionsProvider>
  );
}

function SideNav() {
  const isSideNavExpanded = usePreferencesContext(
    (state) => state.isSideNavExpanded
  );
  const loaderData = useLoaderData<LayoutLoaderData>();
  return (
    <SideNavbar isExpanded={isSideNavExpanded}>
      <Brand />
      <Flex direction="column" justifyContent="space-between" flex="1 1 auto">
        <ul css={sideLinksCSS}>
          <li key="search">
            <GlobalSearch isExpanded={isSideNavExpanded} />
          </li>
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
              leadingVisual={<Icon svg={<Icons.Grid />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="datasets">
            <NavLink
              to="/datasets"
              text="Datasets & Experiments"
              leadingVisual={<Icon svg={<Icons.Database />} />}
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
              leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
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
              leadingVisual={<Icon svg={<Icons.MessageSquare />} />}
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
          <VersionUpdateNotice isExpanded={isSideNavExpanded} />
          <li key="github">
            <GitHubLink isExpanded={isSideNavExpanded} />
          </li>
          <li key="settings">
            <NavLink
              to="/settings"
              text="Settings"
              leadingVisual={<Icon svg={<Icons.Options />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="account">
            <AccountMenu isExpanded={isSideNavExpanded} />
          </li>
        </ul>
      </Flex>
    </SideNavbar>
  );
}
