import { Suspense } from "react";

import {
  Dialog,
  DialogCloseButton,
  Flex,
  IDBadge,
  LinkButton,
  Loading,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { TraceDetails } from "@phoenix/pages/trace";

export function TraceDetailsDialog({
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
      <DialogContent>
        <DialogHeader>
          <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
            <DialogTitle>{title}</DialogTitle>
            <IDBadge id={traceId} tooltipText="Copy Trace ID" />
          </Flex>
          <DialogTitleExtra>
            <LinkButton
              size="S"
              to={`/projects/${projectId}/traces/${encodeURIComponent(traceId)}`}
            >
              View Trace in Project
            </LinkButton>
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        <Suspense fallback={<Loading />}>
          <TraceDetails traceId={traceId} projectId={projectId} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
