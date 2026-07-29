import { useNavigate, useParams, useRouteLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Dialog, Drawer, DialogTitle } from "@phoenix/components";
import { DialogContent } from "@phoenix/components/core/dialog";
import {
  getTraceTreeMaximumWidth,
  TRACE_TREE_TIMING_MIN_WIDTH_PIXELS,
} from "@phoenix/components/trace/traceTreeSizing";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import {
  DetailsPanel,
  DetailsPanelContentBoundary,
  DetailsPanelHeader,
} from "@phoenix/pages/trace/DetailsPanel";
import { TraceDetails } from "@phoenix/pages/trace/TraceDetails";
import { TraceDetailsSkeleton } from "@phoenix/pages/trace/TraceDetailsSkeleton";
import { useDetailsPanelSizing } from "@phoenix/pages/trace/useDetailsPanelSizing";

import type { datasetEvaluatorDetailsLoader } from "./datasetEvaluatorDetailsLoader";

export const EVALUATOR_DETAILS_ROUTE_ID = "evaluatorDetails";

/**
 * A component that shows the details of a trace within the dataset evaluator context
 */
export function EvaluatorTracePage() {
  const { traceId, datasetId, evaluatorId } = useParams();
  const navigate = useNavigate();
  const loaderData = useRouteLoaderData<typeof datasetEvaluatorDetailsLoader>(
    EVALUATOR_DETAILS_ROUTE_ID
  );
  const projectId = loaderData?.projectId;
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const treeMaximumWidth = getTraceTreeMaximumWidth({
    hasTiming: showMetricsInTraceTree,
  });
  const treeAddonWidth = showMetricsInTraceTree
    ? TRACE_TREE_TIMING_MIN_WIDTH_PIXELS
    : 0;
  const {
    defaultDrawerSize,
    isTreeCollapsed,
    maximumDrawerSize,
    minimumDrawerSize,
    onDrawerResize,
    onDrawerSizeChange,
    onPreferredTreeWidthChange,
    onTreeCollapsedChange,
    preferredTreeWidth,
  } = useDetailsPanelSizing({
    treeAddonWidth,
    treeMaximumWidth,
  });

  invariant(traceId, "traceId is required");
  invariant(projectId, "projectId is required");
  invariant(datasetId, "datasetId is required");
  invariant(evaluatorId, "evaluatorId is required");

  return (
    <Drawer
      isOpen
      onClose={() =>
        navigate(`/datasets/${datasetId}/evaluators/${evaluatorId}`)
      }
      defaultSize={defaultDrawerSize}
      minSize={minimumDrawerSize}
      maxSize={maximumDrawerSize}
      onResize={onDrawerResize}
      onResizeEnd={onDrawerSizeChange}
    >
      <Dialog aria-label="Trace details">
        {({ close }) => {
          const treeHeader = (
            <DetailsPanelHeader
              close={close}
              closeLabel="Close trace details"
              isCollapsed={isTreeCollapsed}
              onCollapsedChange={onTreeCollapsedChange}
              title={<DialogTitle>Trace Details</DialogTitle>}
            />
          );
          return (
            <DialogContent>
              <DetailsPanel
                preferredTreeWidth={preferredTreeWidth}
                onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                treeAddonWidth={treeAddonWidth}
                treeMaximumWidth={treeMaximumWidth}
              >
                <DetailsPanelContentBoundary
                  subjectKey={JSON.stringify([projectId, traceId])}
                  navigation={treeHeader}
                  fallback={
                    <TraceDetailsSkeleton
                      isTreePanelCollapsed={isTreeCollapsed}
                      onTreePanelCollapsedChange={onTreeCollapsedChange}
                      treeHeader={treeHeader}
                    />
                  }
                >
                  <TraceDetails
                    traceId={traceId}
                    projectId={projectId}
                    isTreePanelCollapsed={isTreeCollapsed}
                    onTreePanelCollapsedChange={onTreeCollapsedChange}
                    treeHeader={treeHeader}
                  />
                </DetailsPanelContentBoundary>
              </DetailsPanel>
            </DialogContent>
          );
        }}
      </Dialog>
    </Drawer>
  );
}
