import React from "react";
import { Outlet } from "react-router";

import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";

export function TracingRoot() {
  return (
    <StreamStateProvider>
      <Outlet />
    </StreamStateProvider>
  );
}
