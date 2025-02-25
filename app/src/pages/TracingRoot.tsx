import React from "react";
import { useLocation, useParams } from "react-router";

import { TracingProvider } from "@phoenix/contexts/TracingContext";

export function TracingRoot({ children }: React.PropsWithChildren) {
  const { projectId } = useParams();
  if (!projectId) {
    throw new Error("projectId is required");
  }
  // extract the path segment after the projectId, no matter how many segments there are
  const pathSegments = useLocation().pathname.split("/").slice(1);
  // find the first path segment after projectId
  const tableId = pathSegments.slice(pathSegments.indexOf(projectId) + 1)[0];

  return (
    <TracingProvider projectId={projectId} tableId={tableId}>
      {children}
    </TracingProvider>
  );
}
