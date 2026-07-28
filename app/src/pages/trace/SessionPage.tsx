import {
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import invariant from "tiny-invariant";

import {
  Dialog,
  Drawer,
  ErrorBoundary,
  DialogContent,
} from "@phoenix/components";
import { getTraceTreeMaximumWidth } from "@phoenix/components/trace/traceTreeSizing";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { SessionDetailsPaginator } from "@phoenix/pages/trace/SessionDetailsPaginator";
import type { sessionLoader } from "@phoenix/pages/trace/sessionLoader";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

import { DetailsPanelHeader } from "./DetailsPanel";
import { SessionDetails } from "./SessionDetails";
import { useDetailsPanelSizing } from "./useDetailsPanelSizing";

/**
 * A component that shows the details of a session
 */
export function SessionPage() {
  const loaderData = useLoaderData<typeof sessionLoader>();
  invariant(loaderData, "loaderData is required");
  const { sessionId } = useParams();
  invariant(sessionId, "Session ID is required");
  const navigate = useNavigate();
  const location = useLocation();
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
        {({ close }) => (
          <DialogContent>
            <ErrorBoundary>
              <SessionDetails
                key={sessionId}
                sessionId={sessionId}
                sessionDisplayId={loaderData.session.sessionId || ""}
                preferredTreeWidth={preferredTreeWidth}
                onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                isTreePanelCollapsed={isTreeCollapsed}
                onTreePanelCollapsedChange={onTreeCollapsedChange}
                navigationHeader={
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
                }
              />
            </ErrorBoundary>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
