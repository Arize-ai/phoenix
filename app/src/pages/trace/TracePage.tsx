import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import { Dialog, Drawer } from "@phoenix/components";
import { DialogContent } from "@phoenix/components/core/dialog";
import { getTraceTreePanelSizing } from "@phoenix/components/trace/traceTreeSizing";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { TraceDetailsPaginator } from "@phoenix/pages/trace/TraceDetailsPaginator";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

import {
  DetailsPanel,
  DetailsPanelContentBoundary,
  DetailsPanelHeader,
} from "./DetailsPanel";
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
  const { treeAddonWidth, treeMaximumWidth } = getTraceTreePanelSizing({
    hasTiming: showMetricsInTraceTree,
  });
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
        {({ close }) => {
          const treeHeader = (
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
                    defaultToTrace={defaultToTrace}
                    traceId={traceId}
                    projectId={projectId}
                    treeHeader={treeHeader}
                    isTreePanelCollapsed={isTreeCollapsed}
                    onTreePanelCollapsedChange={onTreeCollapsedChange}
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
