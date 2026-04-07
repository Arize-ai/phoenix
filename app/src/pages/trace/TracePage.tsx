import { Suspense } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import {
  Button,
  Dialog,
  Flex,
  Loading,
  Modal,
  ModalOverlay,
  TitleWithID,
} from "@phoenix/components";
import { PxiGlyph } from "@phoenix/components/agent/PxiGlyph";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { ShareLinkButton } from "@phoenix/components/ShareLinkButton";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
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
  const isAgentsEnabled = useFeatureFlag("agents");
  const setIsOpen = useAgentContext((state) => state.setIsOpen);
  const { rootPath, tab } = useProjectRootPath();
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);

  // if we are focused on a particular span, use that as the subjectId
  // otherwise, use the traceId
  const paginationSubjectId = selectedSpanNodeId || traceId;

  return (
    <ModalOverlay
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate(`${rootPath}/${tab}`);
        }
      }}
    >
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <DialogContent>
              <DialogHeader>
                <Flex direction="row" gap="size-200" justifyContent="center">
                  <TraceDetailsPaginator currentId={paginationSubjectId} />
                  <TitleWithID title="Trace" id={traceId as string} />
                </Flex>
                <DialogTitleExtra>
                  {isAgentsEnabled ? (
                    /* The global FAB is intentionally hidden while a modal overlay
                        is open, so traces expose a local PXI entrypoint here. */
                    <Button
                      size="S"
                      variant="primary"
                      leadingVisual={<PxiGlyph variant="resting" />}
                      onPress={() => setIsOpen(true)}
                    >
                      Ask PXI
                    </Button>
                  ) : null}
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
    </ModalOverlay>
  );
}
