import React from "react";
import { Brand, Navbar, GitHubLink } from "../components/nav";
import { Outlet } from "react-router";

export function Layout() {
  return (
    <>
      <Navbar>
        <Brand />
        <GitHubLink />
      </Navbar>
      <Outlet />
    </>
  );
}
