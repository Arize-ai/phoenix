import React from "react";
import {
  Brand,
  Navbar,
  GitHubLink,
  NavBreadcrumb,
} from "@phoenix/components/nav";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

const layoutCSS = css`
  display: flex;
  flex-direction: column;
  height: 100vh;
`;

const contentCSS = css`
  flex: 1 1 auto;
  height: 100%;
`;

const linksCSS = css`
  display: flex;
  flex-direction: row;
  margin: 0;
  list-style: none;
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
            <GitHubLink />
          </li>
        </ul>
      </Navbar>
      <div data-testid="content" css={contentCSS}>
        <Outlet />
      </div>
    </div>
  );
}
