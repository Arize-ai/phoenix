import { usePreloadedQuery } from "react-relay";
import { useLoaderData, useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Dialog,
  ErrorBoundary,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";

import type { sessionLoaderQuery as SessionLoaderQuery } from "./__generated__/sessionLoaderQuery.graphql";
import { SessionDetails } from "./SessionDetails";
import { type SessionLoaderData, sessionLoaderQuery } from "./sessionLoader";

/**
 * A component that shows the details of a session
 */
export function SessionPage() {
  const loaderData = useLoaderData<SessionLoaderData>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<SessionLoaderQuery>(
    sessionLoaderQuery,
    loaderData.queryRef
  );
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { rootPath, tab } = useProjectRootPath();

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
        size="fullscreen"
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
                Session ID: {data.session?.sessionId ?? "--"}
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
    </ModalOverlay>
  );
}
