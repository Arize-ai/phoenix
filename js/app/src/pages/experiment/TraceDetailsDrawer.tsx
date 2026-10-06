import { Suspense } from "react";

import {
  Dialog,
  Drawer,
  Flex,
  LinkButton,
  Loading,
  TitleWithID,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import {
  DRAWER_DEFAULT_MIN_SIZE,
  useDefaultDrawerSize,
} from "@phoenix/components/core/overlay";
import { TraceDetails } from "@phoenix/pages/trace";

/**
 * The trace a compare view has selected for inspection in the drawer.
 */
export type SelectedTraceDetails = {
  traceId: string;
  projectId: string;
  /** Heading shown in the drawer, e.g. "Experiment Run Trace". */
  title: string;
};

/**
 * Shows the details of a trace in a non-modal side drawer, mirroring how the
 * tracing views present a trace, so the user can keep browsing the compare
 * table while the trace stays open.
 */
export function TraceDetailsDrawer({
  traceId,
  projectId,
  title,
  onClose,
}: SelectedTraceDetails & {
  onClose: () => void;
}) {
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "experiment-trace-details",
  });

  return (
    <Drawer
      isOpen
      onClose={onClose}
      defaultSize={defaultSize}
      minSize={DRAWER_DEFAULT_MIN_SIZE}
      onResize={onSizeChange}
    >
      <Dialog>
        {({ close }) => (
          <DialogContent>
            <DialogHeader>
              <Flex
                direction="row"
                gap="size-200"
                alignItems="center"
                minWidth={0}
              >
                <DialogCloseButton close={close} />
                <DialogTitle>
                  <TitleWithID title={title} id={traceId} />
                </DialogTitle>
              </Flex>
              <DialogTitleExtra>
                <LinkButton
                  size="S"
                  to={`/projects/${projectId}/traces/${encodeURIComponent(traceId)}`}
                >
                  View Trace in Project
                </LinkButton>
              </DialogTitleExtra>
            </DialogHeader>
            <Suspense fallback={<Loading />}>
              <TraceDetails traceId={traceId} projectId={projectId} />
            </Suspense>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
