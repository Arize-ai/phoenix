import { Suspense, useCallback, useMemo } from "react";
import { Outlet, useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Loading } from "@phoenix/components";
import {
  Brand,
  DocsLink,
  NavBreadcrumb,
  NavButton,
  NavLink,
  SideNavbar,
  ThemeToggle,
  TopNavbar,
} from "@phoenix/components/nav";
import { useNotifyError } from "@phoenix/contexts";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";
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
  padding-left: var(--px-nav-collapsed-width);
`;
const contentCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
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
  const isDashboardsEnabled = useFeatureFlag("dashboards");
  const hasInferences = useMemo(() => {
    return window.Config.hasInferences;
  }, []);
  const notifyError = useNotifyError();
  const { authenticationEnabled } = useFunctionality();
  const navigate = useNavigate();
  const onLogout = useCallback(async () => {
    const response = await fetch(prependBasename("/auth/logout"), {
      method: "POST",
    });
    if (response.ok) {
      navigate("/login");
      return;
    }
    notifyError({
      title: "Logout Failed",
      message: "Failed to log out: " + response.statusText,
    });
  }, [navigate, notifyError]);
  return (
    <SideNavbar>
      <Brand />
      <Flex direction="column" justifyContent="space-between" flex="1 1 auto">
        <ul css={sideLinksCSS}>
          {hasInferences && (
            <li key="model">
              <NavLink
                to="/model"
                text="Model"
                leadingVisual={<Icon svg={<Icons.CubeOutline />} />}
              />
            </li>
          )}
          <li>
            <NavLink
              to="/projects"
              text="Projects"
              leadingVisual={<Icon svg={<Icons.GridOutline />} />}
            />
          </li>
          {isDashboardsEnabled && (
            <li key="dashboards">
              <NavLink
                to="/dashboards"
                text="Dashboards"
                leadingVisual={<Icon svg={<Icons.BarChartOutline />} />}
              />
            </li>
          )}
          <li key="datasets">
            <NavLink
              to="/datasets"
              text="Datasets"
              leadingVisual={<Icon svg={<Icons.DatabaseOutline />} />}
            />
          </li>
          <li key="playground">
            <NavLink
              to="/playground"
              text="Playground"
              leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
            />
          </li>
          <li key="prompts">
            <NavLink
              to="/prompts"
              text="Prompts"
              leadingVisual={<Icon svg={<Icons.MessageSquareOutline />} />}
            />
          </li>
          <li key="apis">
            <NavLink
              to="/apis"
              text="APIs"
              leadingVisual={<Icon svg={<Icons.Code />} />}
            />
          </li>
        </ul>
        <ul css={bottomLinksCSS}>
          <li key="settings">
            <NavLink
              to="/settings/general"
              text="Settings"
              leadingVisual={<Icon svg={<Icons.SettingsOutline />} />}
            />
          </li>
          <li key="docs">
            <DocsLink />
          </li>
          <li key="support">
            <NavLink
              to="/support"
              text="Support"
              leadingVisual={<Icon svg={<Icons.LifeBuoy />} />}
            />
          </li>
          <li key="theme-toggle">
            <ThemeToggle />
          </li>
          {authenticationEnabled && (
            <>
              <li key="profile">
                <NavLink
                  to="/profile"
                  text="Profile"
                  leadingVisual={<Icon svg={<Icons.PersonOutline />} />}
                />
              </li>
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
