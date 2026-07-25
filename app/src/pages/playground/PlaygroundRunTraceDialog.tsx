import { Suspense } from "react";

import { Dialog, LinkButton, Loading } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { TraceDetails } from "@phoenix/pages/trace";
import { useDetailsPanelSizing } from "@phoenix/pages/trace/useDetailsPanelSizing";

export function PlaygroundRunTraceDetailsDialog({
  traceId,
  projectId,
  title,
}: {
  traceId: string;
  projectId: string;
  title: string;
}) {
  const { onPreferredTreeWidthChange, preferredTreeWidth } =
    useDetailsPanelSizing();

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
          <Suspense fallback={<Loading />}>
            <TraceDetails
              traceId={traceId}
              projectId={projectId}
              preferredTreeWidth={preferredTreeWidth}
              onPreferredTreeWidthChange={onPreferredTreeWidthChange}
            />
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
}
