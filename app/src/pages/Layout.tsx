import React from "react";
import { Brand, Navbar } from "../components/nav";
import { Outlet } from "react-router";

export function Layout() {
  return (
    <>
      <Navbar>
        <Brand />
      </Navbar>
      <Outlet />
    </>
  );
}
