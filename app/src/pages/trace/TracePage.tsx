import { Suspense } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import { Dialog, Drawer } from "@phoenix/components";
import { DialogContent } from "@phoenix/components/core/dialog";
import {
  getTraceTreeMaximumWidth,
  TRACE_TREE_TIMING_MIN_WIDTH_PIXELS,
} from "@phoenix/components/trace/traceTreeSizing";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { TraceDetailsPaginator } from "@phoenix/pages/trace/TraceDetailsPaginator";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

import { DetailsPanelHeader } from "./DetailsPanel";
import { TraceDetails } from "./TraceDetails";
import { TraceDetailsSkeleton } from "./TraceDetailsSkeleton";
import { useDetailsPanelSizing } from "./useDetailsPanelSizing";

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TracePage({
  defaultToTrace = false,
}: {
  defaultToTrace?: boolean;
}) {
  const { traceId, projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { rootPath, tab } = useProjectRootPath();
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const treeMaximumWidth = getTraceTreeMaximumWidth({
    hasTiming: showMetricsInTraceTree,
  });
  const treeAddonWidth = showMetricsInTraceTree
    ? TRACE_TREE_TIMING_MIN_WIDTH_PIXELS
    : 0;
  const parentSearch = clearSelectionScopedParams(searchParams);
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
  if (traceId == null || projectId == null) {
    throw new Error("Trace and project IDs are required");
  }

  // if we are focused on a particular span, use that as the subjectId
  // otherwise, use the traceId
  const paginationSubjectId = selectedSpanNodeId || traceId;

  return (
    <Drawer
      isOpen
      onClose={() =>
        navigate({
          pathname: `${rootPath}/${tab}`,
          search: parentSearch,
          hash: location.hash,
        })
      }
      defaultSize={defaultDrawerSize}
      minSize={minimumDrawerSize}
      maxSize={maximumDrawerSize}
      onResize={onDrawerResize}
      onResizeEnd={onDrawerSizeChange}
    >
      <Dialog aria-label="Trace details">
        {({ close }) => (
          <DialogContent>
            <Suspense
              fallback={
                <TraceDetailsSkeleton
                  preferredTreeWidth={preferredTreeWidth}
                  onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                  isTreePanelCollapsed={isTreeCollapsed}
                  onTreePanelCollapsedChange={onTreeCollapsedChange}
                  treeAddonWidth={treeAddonWidth}
                  treeMaximumWidth={treeMaximumWidth}
                  treeHeader={
                    <DetailsPanelHeader
                      close={close}
                      closeLabel="Close trace details"
                      isCollapsed={isTreeCollapsed}
                      onCollapsedChange={onTreeCollapsedChange}
                      pagination={
                        <TraceDetailsPaginator
                          currentId={paginationSubjectId}
                          isCollapsed={isTreeCollapsed}
                        />
                      }
                    />
                  }
                />
              }
            >
              <TraceDetails
                defaultToTrace={defaultToTrace}
                traceId={traceId}
                projectId={projectId}
                preferredTreeWidth={preferredTreeWidth}
                onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                treeHeader={
                  <DetailsPanelHeader
                    close={close}
                    closeLabel="Close trace details"
                    isCollapsed={isTreeCollapsed}
                    onCollapsedChange={onTreeCollapsedChange}
                    pagination={
                      <TraceDetailsPaginator
                        currentId={paginationSubjectId}
                        isCollapsed={isTreeCollapsed}
                      />
                    }
                  />
                }
                isTreePanelCollapsed={isTreeCollapsed}
                onTreePanelCollapsedChange={onTreeCollapsedChange}
              />
            </Suspense>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
