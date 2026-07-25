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
  Flex,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  TitleWithID,
} from "@phoenix/components";
import { TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS } from "@phoenix/constants";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { SessionDetailsPaginator } from "@phoenix/pages/trace/SessionDetailsPaginator";
import type { sessionLoader } from "@phoenix/pages/trace/sessionLoader";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

import { SessionDetails } from "./SessionDetails";
import { useDetailsPanelSizing } from "./useDetailsPanelSizing";

/**
 * A component that shows the details of a session
 */
export function SessionPage() {
  const loaderData = useLoaderData<typeof sessionLoader>();
  invariant(loaderData, "loaderData is required");
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { rootPath, tab } = useProjectRootPath();
  const parentSearch = clearSelectionScopedParams(location.search);
  const {
    defaultDrawerSize,
    onDrawerSizeChange,
    onPreferredTreeWidthChange,
    preferredTreeWidth,
  } = useDetailsPanelSizing();

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
      minSize={TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS}
      onResize={onDrawerSizeChange}
    >
      <Dialog>
        {({ close }) => (
          <DialogContent>
            <DialogHeader>
              <Flex direction="row" gap="size-200" alignItems="center">
                <DialogCloseButton close={close} />
                <SessionDetailsPaginator currentId={sessionId} />
                <DialogTitle>
                  <TitleWithID
                    title="Session"
                    id={loaderData.session.sessionId || ""}
                  />
                </DialogTitle>
              </Flex>
            </DialogHeader>
            <ErrorBoundary>
              <SessionDetails
                sessionId={sessionId as string}
                preferredTreeWidth={preferredTreeWidth}
                onPreferredTreeWidthChange={onPreferredTreeWidthChange}
              />
            </ErrorBoundary>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
