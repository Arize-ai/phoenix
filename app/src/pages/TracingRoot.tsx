import React from "react";
import { useParams } from "react-router";

import { TracingProvider } from "@phoenix/contexts/TracingContext";
import { isProjectTab } from "@phoenix/features/project/pages/constants";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";

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
