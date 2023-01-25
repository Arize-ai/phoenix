import React from "react";
import { Brand, Navbar, GitHubLink } from "../components/nav";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

const linksCSS = css`
  display: flex;
  flex-direction: row;
  margin: 0;
  list-style: none;
  padding-inline-start: 0;
`;
export function Layout() {
  return (
    <>
      <Navbar>
        <Brand />
        <ul css={linksCSS}>
          <li>
            <GitHubLink />
          </li>
        </ul>
      </Navbar>
      <Outlet />
    </>
  );
}
