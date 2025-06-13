import { useLoaderData, useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  Dialog,
  ErrorBoundary,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { sessionLoader } from "@phoenix/pages/trace/sessionLoader";

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

  return (
    <ModalOverlay
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate(`${rootPath}/${tab}`);
        }
      }}
    >
      <Modal variant="slideover" size="L">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Session ID: {loaderData.session?.sessionId ?? "--"}
              </DialogTitle>
              <DialogTitleExtra>
                <Button
                  size="S"
                  data-testid="dialog-close-button"
                  leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
                  onPress={() => navigate(`${rootPath}/${tab}`)}
                  type="button"
                  variant="default"
                  slot="close"
                />
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
