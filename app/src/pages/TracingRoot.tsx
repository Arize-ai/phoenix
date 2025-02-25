import React from "react";
import { useParams } from "react-router";

import { TracingProvider } from "@phoenix/contexts/TracingContext";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";

export function TracingRoot({ children }: React.PropsWithChildren) {
  const { projectId } = useParams();
  if (!projectId) {
    throw new Error("projectId is required");
  }
  const { tab } = useProjectRootPath();

  return (
    <TracingProvider projectId={projectId} tableId={tab}>
      {children}
    </TracingProvider>
  );
}
