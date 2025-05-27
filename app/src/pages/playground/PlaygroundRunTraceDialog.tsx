import { Dialog, LinkButton } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
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
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogTitleExtra>
              <LinkButton
                size="S"
                to={`/projects/${projectId}/traces/${traceId}`}
              >
                View Trace in Project
              </LinkButton>
              <DialogCloseButton close={close} />
            </DialogTitleExtra>
          </DialogHeader>
          <TraceDetails traceId={traceId} projectId={projectId} />
        </DialogContent>
      )}
    </Dialog>
  );
}
