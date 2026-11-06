import { TimeRangeProvider } from "@phoenix/components/datetime";

import { DashboardsPage } from "./DashboardsPage";

export function DashboardsRoot() {
  return (
    <TimeRangeProvider>
      <DashboardsPage />
    </TimeRangeProvider>
  );
}
