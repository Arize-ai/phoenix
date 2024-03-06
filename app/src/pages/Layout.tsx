import React, { Suspense, useMemo } from "react";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import { Flex, Icon, Icons } from "@arizeai/components";

import { Loading } from "@phoenix/components";
import {
  Brand,
  DocsLink,
  GitHubLink,
  NavBreadcrumb,
  NavLink,
  SideNavbar,
  ThemeToggle,
  TopNavbar,
} from "@phoenix/components/nav";

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
  const hasInferences = useMemo(() => {
    return window.Config.hasInferences;
  }, []);
  return (
    <SideNavbar>
      <Brand />
      <Flex direction="column" justifyContent="space-between" flex="1 1 auto">
        <ul css={sideLinksCSS}>
          {hasInferences && (
            <li>
              <NavLink
                to="/model"
                text="Model"
                icon={<Icon svg={<Icons.Cube />} />}
              />
            </li>
          )}
          <li>
            <NavLink
              to="/projects/default"
              text="Projects"
              icon={<Icon svg={<Icons.Grid />} />}
            />
          </li>
        </ul>
        <ul css={bottomLinksCSS}>
          <li>
            <DocsLink />
          </li>
          <li>
            <GitHubLink />
          </li>
          <li>
            <ThemeToggle />
          </li>
        </ul>
      </Flex>
    </SideNavbar>
  );
}
