import { css } from "@emotion/react";
import { useLoaderData, useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Dialog,
  ErrorBoundary,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { CopyButton } from "@phoenix/components/core/copy";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import type { sessionLoader } from "@phoenix/pages/trace/sessionLoader";

import { SessionDetails } from "./SessionDetails";

const dialogTitleIdCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-static-size-50);

  .copy-button {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-in-out;
  }

  &:hover .copy-button,
  .copy-button:focus-within {
    opacity: 1;
    pointer-events: auto;
  }
`;

const monoCSS = css`
  font-family: "Geist Mono", monospace;
  white-space: nowrap;
`;

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
                <span css={dialogTitleIdCSS}>
                  Session ID:{" "}
                  <span css={monoCSS}>
                    {loaderData.session?.sessionId ?? "--"}
                  </span>
                  <CopyButton
                    text={loaderData.session?.sessionId ?? ""}
                    variant="quiet"
                    size="S"
                  />
                </span>
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
