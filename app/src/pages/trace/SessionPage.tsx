import { useLoaderData, useNavigate, useParams } from "react-router";
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
import { DRAWER_DEFAULT_MIN_SIZE } from "@phoenix/components/core/overlay/constants";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { SessionDetailsPaginator } from "@phoenix/pages/trace/SessionDetailsPaginator";
import type { sessionLoader } from "@phoenix/pages/trace/sessionLoader";

import { SessionDetails } from "./SessionDetails";

/**
 * A component that shows the details of a session
 */
export function SessionPage() {
  const loaderData = useLoaderData<typeof sessionLoader>();
  invariant(loaderData, "loaderData is required");
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { rootPath, tab } = useProjectRootPath();
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "session-details",
  });

  return (
    <Drawer
      isOpen
      onClose={() => navigate(`${rootPath}/${tab}`)}
      defaultSize={defaultSize}
      minSize={DRAWER_DEFAULT_MIN_SIZE}
      onResize={onSizeChange}
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
              <SessionDetails sessionId={sessionId as string} />
            </ErrorBoundary>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
