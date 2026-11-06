import { Outlet } from "react-router";

import { TimeRangeProvider } from "@phoenix/components/datetime";

export function ProjectsRoot() {
  return (
    <TimeRangeProvider>
      <Outlet />
    </TimeRangeProvider>
  );
}
