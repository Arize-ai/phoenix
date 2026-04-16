import { useLoaderData, useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Dialog,
  ErrorBoundary,
  Flex,
  Modal,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  TitleWithID,
} from "@phoenix/components";
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
    <Modal
      variant="slideover"
      isResizable
      isOpen
      defaultWidth={defaultWidth}
      onResize={onWidthChange}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate(`${rootPath}/${tab}`);
        }
      }}
    >
      <Dialog>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Flex direction="row" gap="size-200" alignItems="center">
                <SessionDetailsPaginator currentId={sessionId} />
                <TitleWithID
                  title="Session"
                  id={loaderData.session.sessionId || ""}
                />
              </Flex>
            </DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton slot="close" />
            </DialogTitleExtra>
          </DialogHeader>
          <ErrorBoundary>
            <SessionDetails sessionId={sessionId as string} />
          </ErrorBoundary>
        </DialogContent>
      </Dialog>
    </Modal>
  );
}
