import React from "react";
import { useNavigate, useParams } from "react-router";

import { Dialog, DialogContainer } from "@arizeai/components";

import { TraceDetails } from "./TraceDetails";

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TracePage() {
  const { traceId, projectId } = useParams();
  const navigate = useNavigate();
  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate(`/projects/${projectId}`)}
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
