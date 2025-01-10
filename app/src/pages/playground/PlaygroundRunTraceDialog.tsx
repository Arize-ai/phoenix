import React from "react";
import { useNavigate } from "react-router";

import { Dialog } from "@arizeai/components";

import { Button } from "@phoenix/components";
import { TraceDetails } from "@phoenix/pages/trace";

export function PlaygroundRunTraceDetailsDialog({
  traceId,
  projectId,
  title,
}: {
  traceId: string;
  projectId: string;
  title: string;
}) {
  const navigate = useNavigate();
  return (
    <Dialog
      title={title}
      size="fullscreen"
      extra={
        <Button
          onPress={() => navigate(`/projects/${projectId}/traces/${traceId}`)}
        >
          View Trace in Project
        </Button>
      }
    >
      <TraceDetails traceId={traceId} projectId={projectId} />
    </Dialog>
  );
}
