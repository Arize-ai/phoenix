import { css } from "@emotion/react";
import { Suspense, useRef } from "react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";
import { Outlet, useLoaderData } from "react-router";

import { Counter, Flex, Icon, Icons, Loading } from "@phoenix/components";
import {
  AgentChatPanel,
  AgentChatTopNavButton,
  AgentChatWidget,
  ASSISTANT_RAIL_PANEL_ID,
  FloatingAgentChatPanel,
  useAssistantAgentEnabled,
} from "@phoenix/components/agent";
import {
  DrawerPlane,
  OverlayFrameProvider,
  useOverlayFrame,
  ViewportModalPlane,
  viewportModalInteractionExemptProps,
  ViewportPortal,
} from "@phoenix/components/core/overlay";
import { ToastRegion } from "@phoenix/components/core/toast/ToastRegion";
import { APP_FLOATING_Z_INDEX } from "@phoenix/components/core/zIndex";
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
  useResponsiveSideNav,
  VersionUpdateNotice,
} from "@phoenix/components/nav";
import { GlobalSearch } from "@phoenix/components/search";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";

import type { layoutLoaderQuery } from "./__generated__/layoutLoaderQuery.graphql";
import type { LayoutLoaderData } from "./layoutLoader";
import { layoutLoaderGql } from "./layoutLoader";

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
  position: relative;
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

const topNavPageControlsCSS = css`
  display: contents;
`;

const topNavAssistantControlCSS = css`
  position: relative;
  z-index: ${APP_FLOATING_Z_INDEX};
  flex: none;
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

const drawerPlaneCellCSS = css`
  grid-column: 1 / 3;
  grid-row: 2;
`;

const viewportModalPlaneCellCSS = css`
  grid-column: 1 / 3;
  grid-row: 1 / 3;
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
    <OverlayFrameProvider>
      <ApplicationFrame />
    </OverlayFrameProvider>
  );
}

function ApplicationFrame() {
  const contentRef = useRef<HTMLDivElement>(null);
  const frame = useOverlayFrame();
  const { isSideNavExpanded, isSideNavExpansionAllowed, setIsSideNavExpanded } =
    useResponsiveSideNav();
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
    ? ["layout-content", ASSISTANT_RAIL_PANEL_ID]
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
              ref={frame?.setApplicationViewportElement}
            >
              <ViewportPortal>
                <ToastRegion />
              </ViewportPortal>
              <div
                data-testid="application-side-navigation"
                css={sideNavCellCSS}
                inert={frame?.isViewportBlocked || undefined}
                ref={frame?.setSideNavigationElement}
              >
                <SideNav isExpanded={isSideNavExpanded} />
              </div>
              <div data-testid="application-top-navigation" css={topNavCellCSS}>
                <TopNavbar>
                  <div
                    className="top-navbar__page-controls"
                    css={topNavPageControlsCSS}
                    data-testid="application-top-navigation-page-controls"
                    inert={frame?.isViewportBlocked || undefined}
                  >
                    <SideNavToggleButton
                      isExpanded={isSideNavExpanded}
                      isDisabled={!isSideNavExpansionAllowed}
                      onExpandedChange={setIsSideNavExpanded}
                    />
                    <NavBreadcrumb />
                    <TopNavActionsSlot />
                  </div>
                  {isAgentFabFloating ? null : (
                    <div
                      className="top-navbar__assistant-control"
                      css={topNavAssistantControlCSS}
                      {...viewportModalInteractionExemptProps}
                    >
                      <AgentChatTopNavButton />
                    </div>
                  )}
                </TopNavbar>
              </div>
              <div
                data-testid="content"
                css={contentCSS}
                inert={frame?.isViewportBlocked || undefined}
                ref={contentRef}
              >
                <Suspense fallback={<Loading />}>
                  <Outlet />
                </Suspense>
              </div>
              <DrawerPlane css={drawerPlaneCellCSS} />
              <ViewportModalPlane css={viewportModalPlaneCellCSS} />
            </div>
            {isAgentFabFloating ? (
              <AgentChatWidget boundaryRef={contentRef} />
            ) : null}
            {shouldShowFloatingAgentPanel ? (
              <FloatingAgentChatPanel boundaryRef={contentRef} />
            ) : null}
          </Panel>
          {shouldShowDockedAgentPanel ? <AgentChatPanel /> : null}
        </Group>
      </div>
    </TopNavActionsProvider>
  );
}

function SideNav({ isExpanded }: { isExpanded: boolean }) {
  const loaderData = useLoaderData<LayoutLoaderData>();
  return (
    <Suspense fallback={<SideNavContent isExpanded={isExpanded} />}>
      <SideNavWithCounts
        isExpanded={isExpanded}
        queryRef={loaderData.queryRef}
      />
    </Suspense>
  );
}

function SideNavWithCounts({
  isExpanded,
  queryRef,
}: {
  isExpanded: boolean;
  queryRef: LayoutLoaderData["queryRef"];
}) {
  const counts = useOwnedPreloadedQuery<layoutLoaderQuery>({
    query: layoutLoaderGql,
    queryRef,
  });

  return <SideNavContent isExpanded={isExpanded} counts={counts} />;
}

function SideNavContent({
  isExpanded,
  counts,
}: {
  isExpanded: boolean;
  counts?: layoutLoaderQuery["response"];
}) {
  return (
    <SideNavbar isExpanded={isExpanded}>
      <Brand />
      <Flex direction="column" justifyContent="space-between" flex="1 1 auto">
        <ul css={sideLinksCSS}>
          <li key="search">
            <GlobalSearch isExpanded={isExpanded} />
          </li>
          <li>
            <NavLink
              to="/projects"
              text="Tracing"
              leadingVisual={<Icon svg={<Icons.Trace />} />}
              trailingVisual={
                counts?.projectCount != null ? (
                  <Counter variant="quiet">{counts.projectCount}</Counter>
                ) : undefined
              }
              isExpanded={isExpanded}
            />
          </li>
          <li key="dashboards">
            <NavLink
              to="/dashboards"
              text="Dashboards"
              leadingVisual={<Icon svg={<Icons.Grid />} />}
              isExpanded={isExpanded}
            />
          </li>
          <li key="datasets">
            <NavLink
              to="/datasets"
              text="Datasets & Experiments"
              leadingVisual={<Icon svg={<Icons.Database />} />}
              trailingVisual={
                counts?.datasetCount != null ? (
                  <Counter variant="quiet">{counts.datasetCount}</Counter>
                ) : undefined
              }
              isExpanded={isExpanded}
            />
          </li>
          <li key="playground">
            <NavLink
              to="/playground"
              text="Playground"
              leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
              isExpanded={isExpanded}
            />
          </li>
          <li key="evaluators">
            <NavLink
              to="/evaluators"
              text="Evaluators"
              leadingVisual={<Icon svg={<Icons.Scale />} />}
              trailingVisual={
                counts?.evaluatorCount != null ? (
                  <Counter variant="quiet">{counts.evaluatorCount}</Counter>
                ) : undefined
              }
              isExpanded={isExpanded}
            />
          </li>
          <li key="prompts">
            <NavLink
              to="/prompts"
              text="Prompts"
              leadingVisual={<Icon svg={<Icons.MessageSquare />} />}
              trailingVisual={
                counts?.promptCount != null ? (
                  <Counter variant="quiet">{counts.promptCount}</Counter>
                ) : undefined
              }
              isExpanded={isExpanded}
            />
          </li>
          <li key="rest-api">
            <NavLink
              to="/apis/rest"
              text="REST API"
              leadingVisual={<Icon svg={<Icons.Code />} />}
              isExpanded={isExpanded}
            />
          </li>
          <li key="graphql">
            <NavLink
              to="/apis/graphql"
              text="GraphQL"
              leadingVisual={<Icon svg={<Icons.GraphQL />} />}
              isExpanded={isExpanded}
            />
          </li>
        </ul>
        <ul css={bottomLinksCSS}>
          <VersionUpdateNotice isExpanded={isExpanded} />
          <li key="github">
            <GitHubLink isExpanded={isExpanded} />
          </li>
          <li key="settings">
            <NavLink
              to="/settings"
              text="Settings"
              leadingVisual={<Icon svg={<Icons.Options />} />}
              isExpanded={isExpanded}
            />
          </li>
          <li key="account">
            <AccountMenu isExpanded={isExpanded} />
          </li>
        </ul>
      </Flex>
    </SideNavbar>
  );
}
