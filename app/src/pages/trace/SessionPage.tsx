import { Suspense } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import invariant from "tiny-invariant";

import {
  Dialog,
  Drawer,
  ErrorBoundary,
  DialogContent,
} from "@phoenix/components";
import { getTraceTreeMaximumWidth } from "@phoenix/components/trace/traceTreeSizing";
import { SESSION_VIEW_PARAM } from "@phoenix/constants/searchParams";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { SessionDetailsPaginator } from "@phoenix/pages/trace/SessionDetailsPaginator";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

import { DetailsPanelHeader } from "./DetailsPanel";
import { SessionDetails } from "./SessionDetails";
import { SessionDetailsSkeleton } from "./SessionDetailsSkeleton";
import {
  getSessionPreview,
  useSessionPagination,
} from "./SessionPaginationContext";
import { isSessionView, type SessionView } from "./SessionViewTabs";
import { useDetailsPanelSizing } from "./useDetailsPanelSizing";

/**
 * A component that shows the details of a session
 */
export function SessionPage() {
  const { sessionId } = useParams();
  invariant(sessionId, "Session ID is required");
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const pagination = useSessionPagination();
  const { rootPath, tab } = useProjectRootPath();
  const parentSearch = clearSelectionScopedParams(location.search);
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
    treeMaximumWidth: getTraceTreeMaximumWidth({ hasTiming: false }),
  });
  const preview = getSessionPreview(
    pagination?.sessionSequence ?? [],
    sessionId
  ) ?? { sessionId };
  const sessionViewParam = searchParams.get(SESSION_VIEW_PARAM);
  const sessionView: SessionView = isSessionView(sessionViewParam)
    ? sessionViewParam
    : "turns";
  const handleSessionViewChange = (view: SessionView) => {
    setSearchParams(
      (nextSearchParams) => {
        nextSearchParams.set(SESSION_VIEW_PARAM, view);
        return nextSearchParams;
      },
      { replace: true }
    );
  };

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
      <Dialog aria-label="Session details">
        {({ close }) => {
          const navigationHeader = (
            <DetailsPanelHeader
              close={close}
              closeLabel="Close session details"
              isCollapsed={isTreeCollapsed}
              onCollapsedChange={onTreeCollapsedChange}
              pagination={
                <SessionDetailsPaginator
                  currentId={sessionId}
                  isCollapsed={isTreeCollapsed}
                />
              }
            />
          );
          return (
            <DialogContent>
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <SessionDetailsSkeleton
                      isTreePanelCollapsed={isTreeCollapsed}
                      navigationHeader={navigationHeader}
                      onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                      onSessionViewChange={handleSessionViewChange}
                      onTreePanelCollapsedChange={onTreeCollapsedChange}
                      preferredTreeWidth={preferredTreeWidth}
                      preview={preview}
                      sessionView={sessionView}
                    />
                  }
                >
                  <SessionDetails
                    key={sessionId}
                    sessionId={sessionId}
                    preferredTreeWidth={preferredTreeWidth}
                    onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                    isTreePanelCollapsed={isTreeCollapsed}
                    onTreePanelCollapsedChange={onTreeCollapsedChange}
                    navigationHeader={navigationHeader}
                  />
                </Suspense>
              </ErrorBoundary>
            </DialogContent>
          );
        }}
      </Dialog>
    </Drawer>
  );
}
