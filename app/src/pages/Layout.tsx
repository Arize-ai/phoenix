import React, { Suspense, useMemo } from "react";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import { Icon, Icons } from "@arizeai/components";

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

const linksCSS = css`
  display: flex;
  flex-direction: row;
  margin: 0;
  list-style: none;
  gap: var(--ac-global-dimension-size-100);
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
          <ul css={linksCSS}>
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
    </SideNavbar>
  );
}
