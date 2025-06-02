import { Suspense } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { Dialog, Loading, Modal } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { ShareLinkButton } from "@phoenix/components/ShareLinkButton";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { TraceDetailsPaginator } from "@phoenix/pages/trace/TraceDetailsPaginator";

import { TraceDetails } from "./TraceDetails";

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TracePage() {
  const { traceId, projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { rootPath, tab } = useProjectRootPath();
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);

  // if we are focused on a particular span, use that as the subjectId
  // otherwise, use the traceId
  const paginationSubjectId = selectedSpanNodeId || traceId;

  return (
    <Modal
      variant="slideover"
      size="fullscreen"
      isOpen
      isDismissable
      shouldCloseOnInteractOutside={() => false}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate(`${rootPath}/${tab}`);
        }
      }}
    >
      <Dialog>
        {({ close }) => (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Trace Details</DialogTitle>
              <DialogTitleExtra>
                <TraceDetailsPaginator currentId={paginationSubjectId} />
                <ShareLinkButton
                  preserveSearchParams
                  buttonText="Share"
                  tooltipText="Copy trace link to clipboard"
                  successText="Trace link copied to clipboard"
                />
                <DialogCloseButton close={close} />
              </DialogTitleExtra>
            </DialogHeader>
            <Suspense fallback={<Loading />}>
              <TraceDetails
                traceId={traceId as string}
                projectId={projectId as string}
              />
            </Suspense>
          </DialogContent>
        )}
      </Dialog>
    </Modal>
  );
}
