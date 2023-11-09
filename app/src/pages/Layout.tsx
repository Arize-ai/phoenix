import React from "react";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import {
  Brand,
  DocsLink,
  GitHubLink,
  Navbar,
  NavBreadcrumb,
  ThemeToggle,
} from "@phoenix/components/nav";

const layoutCSS = css`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
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

export function Layout() {
  return (
    <div css={layoutCSS} data-testid="layout">
      <Navbar>
        <Brand />
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
      </Navbar>
      <div data-testid="content" css={contentCSS}>
        <Outlet />
      </div>
    </div>
  );
}
