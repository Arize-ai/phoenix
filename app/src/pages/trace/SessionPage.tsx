import { useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import invariant from "tiny-invariant";

import { Dialog, Drawer, DialogContent } from "@phoenix/components";
import { getTraceTreeMaximumWidth } from "@phoenix/components/trace/traceTreeSizing";
import { SESSION_VIEW_PARAM } from "@phoenix/constants/searchParams";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { SessionDetailsPaginator } from "@phoenix/pages/trace/SessionDetailsPaginator";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

import {
  DetailsPanel,
  DetailsPanelContentBoundary,
  DetailsPanelHeader,
} from "./DetailsPanel";
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
  // The loaded view and every loading fallback replace their navigation DOM.
  // Keep pointer ownership in the stable page shell so the collapsed overlay
  // cannot lose its width while a first-time view switch suspends.
  const [isNavigationPointerOpen, setIsNavigationPointerOpen] = useState(false);
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
              <DetailsPanel
                dataTestId={
                  sessionView === "traces" ? "session-traces-view" : undefined
                }
                navigationAriaLabel="Resize session turns"
                preferredTreeWidth={preferredTreeWidth}
                onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                treeMaximumWidth={getTraceTreeMaximumWidth({
                  hasTiming: false,
                })}
              >
                <DetailsPanelContentBoundary
                  subjectKey={sessionId}
                  navigation={navigationHeader}
                  fallback={
                    <SessionDetailsSkeleton
                      isTreePanelCollapsed={isTreeCollapsed}
                      isNavigationPointerOpen={isNavigationPointerOpen}
                      navigationHeader={navigationHeader}
                      onNavigationPointerOpenChange={setIsNavigationPointerOpen}
                      onSessionViewChange={handleSessionViewChange}
                      onTreePanelCollapsedChange={onTreeCollapsedChange}
                      preview={preview}
                      sessionView={sessionView}
                    />
                  }
                >
                  <SessionDetails
                    sessionId={sessionId}
                    isTreePanelCollapsed={isTreeCollapsed}
                    isNavigationPointerOpen={isNavigationPointerOpen}
                    onNavigationPointerOpenChange={setIsNavigationPointerOpen}
                    onTreePanelCollapsedChange={onTreeCollapsedChange}
                    navigationHeader={navigationHeader}
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
