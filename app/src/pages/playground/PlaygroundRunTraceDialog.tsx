import { Dialog, LinkButton } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import {
  getTraceTreeMaximumWidth,
  TRACE_TREE_TIMING_MIN_WIDTH_PIXELS,
} from "@phoenix/components/trace/traceTreeSizing";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { TraceDetails } from "@phoenix/pages/trace";
import {
  DetailsPanel,
  DetailsPanelContentBoundary,
} from "@phoenix/pages/trace/DetailsPanel";
import { TraceDetailsSkeleton } from "@phoenix/pages/trace/TraceDetailsSkeleton";
import { useSharedTreePreference } from "@phoenix/pages/trace/useDetailsPanelSizing";

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
    useSharedTreePreference();
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const treeAddonWidth = showMetricsInTraceTree
    ? TRACE_TREE_TIMING_MIN_WIDTH_PIXELS
    : 0;
  const treeMaximumWidth = getTraceTreeMaximumWidth({
    hasTiming: showMetricsInTraceTree,
  });

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
          <DetailsPanel
            preferredTreeWidth={preferredTreeWidth}
            onPreferredTreeWidthChange={onPreferredTreeWidthChange}
            treeAddonWidth={treeAddonWidth}
            treeMaximumWidth={treeMaximumWidth}
          >
            <DetailsPanelContentBoundary
              subjectKey={JSON.stringify([projectId, traceId])}
              navigation={null}
              fallback={<TraceDetailsSkeleton />}
            >
              <TraceDetails traceId={traceId} projectId={projectId} />
            </DetailsPanelContentBoundary>
          </DetailsPanel>
        </DialogContent>
      )}
    </Dialog>
  );
}
