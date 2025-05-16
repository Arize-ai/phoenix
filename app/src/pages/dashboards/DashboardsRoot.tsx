import { Outlet } from "react-router";

import { TimeRangeProvider } from "@phoenix/components/datetime";

export function DashboardsRoot() {
  return (
    <TimeRangeProvider>
      <Outlet />
    </TimeRangeProvider>
  );
}
