import { Suspense, useCallback, useMemo } from "react";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Loading } from "@phoenix/components";
import {
  Brand,
  DocsLink,
  GitHubLink,
  ManagementLink,
  NavBreadcrumb,
  NavButton,
  NavLink,
  SideNavbar,
  SideNavToggleButton,
  ThemeSelector,
  TopNavbar,
} from "@phoenix/components/nav";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

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
  border-left: 1px solid var(--ac-global-color-grey-200);
  border-top: 1px solid var(--ac-global-color-grey-200);
  border-radius: var(--ac-global-rounding-medium) 0 0 0;
  /* Fill the background of the content */
  box-shadow: 0 0 10px 10px var(--ac-global-color-grey-100);
`;

const bottomLinksCSS = css`
  display: flex;
  flex-direction: column;
  margin: 0;
  list-style: none;
  gap: var(--ac-global-dimension-size-50);
  padding-inline-start: 0;
`;

const sideLinksCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-50);
`;

export function Layout() {
  return (
    <div css={layoutCSS} data-testid="layout">
      <SideNav />
      <div css={mainViewCSS}>
        <TopNavbar>
          <SideNavToggleButton />
          <NavBreadcrumb />
        </TopNavbar>
        <div data-testid="content" css={contentCSS}>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function SideNav() {
  const isSideNavExpanded = usePreferencesContext(
    (state) => state.isSideNavExpanded
  );
  const hasInferences = useMemo(() => {
    return window.Config.hasInferences;
  }, []);
  const { authenticationEnabled } = useFunctionality();
  const onLogout = useCallback(() => {
    window.location.replace(prependBasename("/auth/logout"));
  }, []);
  return (
    <SideNavbar isExpanded={isSideNavExpanded}>
      <Brand />
      <Flex direction="column" justifyContent="space-between" flex="1 1 auto">
        <ul css={sideLinksCSS}>
          {hasInferences && (
            <li key="model">
              <NavLink
                to="/model"
                text="Model"
                leadingVisual={<Icon svg={<Icons.CubeOutline />} />}
                isExpanded={isSideNavExpanded}
              />
            </li>
          )}
          <li>
            <NavLink
              to="/projects"
              text="Projects"
              leadingVisual={<Icon svg={<Icons.GridOutline />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="datasets">
            <NavLink
              to="/datasets"
              text="Datasets & Experiments"
              leadingVisual={<Icon svg={<Icons.DatabaseOutline />} />}
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
          <li key="prompts">
            <NavLink
              to="/prompts"
              text="Prompts"
              leadingVisual={<Icon svg={<Icons.MessageSquareOutline />} />}
              isExpanded={isSideNavExpanded}
            />
          </li>
          <li key="apis">
            <NavLink
              to="/apis"
              text="APIs"
              leadingVisual={<Icon svg={<Icons.Code />} />}
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
