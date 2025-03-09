import React from "react";
import { useParams } from "react-router";

import { TracingProvider } from "@phoenix/contexts/TracingContext";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { isProjectTab } from "@phoenix/pages/project/constants";

export function TracingRoot({ children }: React.PropsWithChildren) {
  const { projectId } = useParams();

  if (!projectId) {
    throw new Error("projectId is required");
  }
  const { tab } = useProjectRootPath();
  if (!isProjectTab(tab)) {
    throw new Error(`Invalid tab: ${tab}`);
  }

  return (
    <TracingProvider projectId={projectId} tableId={tab || "table"}>
      {children}
    </TracingProvider>
  );
}
