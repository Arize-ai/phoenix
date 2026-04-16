import { useLoaderData, useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Dialog,
  ErrorBoundary,
  Flex,
  Modal,
  ModalOverlay,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  TitleWithID,
} from "@phoenix/components";
import { SLIDEOVER_MIN_WIDTH } from "@phoenix/components/core/overlay/constants";
import { useDefaultModalWidth } from "@phoenix/components/core/overlay/useDefaultModalWidth";
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
  const { defaultWidth, onWidthChange } = useDefaultModalWidth({
    id: "session-details",
  });

  return (
    <ModalOverlay
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate(`${rootPath}/${tab}`);
        }
      }}
    >
      <Modal
        variant="slideover"
        isResizable
        defaultWidth={defaultWidth}
        minWidth={SLIDEOVER_MIN_WIDTH}
        onResize={onWidthChange}
      >
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <Flex direction="row" gap="size-200" alignItems="center">
                <DialogCloseButton slot="close" />
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
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
