import { Dialog } from "@arizeai/components";

import { LinkButton } from "@phoenix/components";
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
  return (
    <Dialog
      title={title}
      size="fullscreen"
      extra={
        <LinkButton size="S" to={`/projects/${projectId}/traces/${traceId}`}>
          View Trace in Project
        </LinkButton>
      }
    >
      <TraceDetails traceId={traceId} projectId={projectId} />
    </Dialog>
  );
}
