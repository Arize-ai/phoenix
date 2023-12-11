import React from "react";
import { Outlet } from "react-router";

import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";

export function TracingRoot() {
  return (
    <TracingProvider>
      <StreamStateProvider>
        <Outlet />
      </StreamStateProvider>
    </TracingProvider>
  );
}
