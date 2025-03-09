import React from "react";
import { useNavigate, useParams } from "react-router";

import { Dialog, DialogContainer } from "@arizeai/components";

import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";

import { TraceDetails } from "./TraceDetails";

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TracePage() {
  const { traceId, projectId } = useParams();
  const navigate = useNavigate();
  const { rootPath, tab } = useProjectRootPath();

  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate(`${rootPath}/${tab}`)}
    >
      <Dialog size="fullscreen" title="Trace Details">
        <TraceDetails
          traceId={traceId as string}
          projectId={projectId as string}
        />
      </Dialog>
    </DialogContainer>
  );
}
