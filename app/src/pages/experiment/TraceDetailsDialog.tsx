import { Suspense } from "react";
import { useNavigate } from "react-router";

import {
  Button,
  Dialog,
  DialogCloseButton,
  Loading,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
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
  const navigate = useNavigate();
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogTitleExtra>
            <Button
              size="S"
              onPress={() =>
                navigate(`/projects/${projectId}/traces/${traceId}`)
              }
            >
              View Trace in Project
            </Button>
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
