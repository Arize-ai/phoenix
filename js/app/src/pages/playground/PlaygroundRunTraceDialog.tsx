import { Suspense } from "react";

import { Dialog, LinkButton } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { TraceDetails, TraceDetailsSkeleton } from "@phoenix/pages/trace";

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
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogTitleExtra>
              <LinkButton
                size="S"
                to={`/projects/${projectId}/traces/${encodeURIComponent(traceId)}`}
              >
                View Trace in Project
              </LinkButton>
              <DialogCloseButton close={close} />
            </DialogTitleExtra>
          </DialogHeader>
          <Suspense fallback={<TraceDetailsSkeleton />}>
            <TraceDetails traceId={traceId} projectId={projectId} />
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
}
