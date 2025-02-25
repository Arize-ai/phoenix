import React from "react";
import { Outlet, useParams } from "react-router";

import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";

export function TracingRoot() {
  const { projectId } = useParams();
  if (!projectId) {
    throw new Error("projectId is required");
  }
  return (
    // TODO: push selected tab state to the url, use for tableId instead of hardcoding to "trace"
    <TracingProvider projectId={projectId} tableId={"trace"}>
      <StreamStateProvider>
        <Outlet />
      </StreamStateProvider>
    </TracingProvider>
  );
}
