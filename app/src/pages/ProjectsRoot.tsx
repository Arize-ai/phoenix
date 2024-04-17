import React from "react";
import { Outlet } from "react-router";

import { LastNTimeRangeProvider } from "@phoenix/components/datetime";

export function ProjectsRoot() {
  return (
    <LastNTimeRangeProvider>
      <Outlet />
    </LastNTimeRangeProvider>
  );
}
