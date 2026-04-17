import { Suspense } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import {
  Button,
  Dialog,
  Drawer,
  Flex,
  Loading,
  TitleWithID,
} from "@phoenix/components";
import { PxiGlyph } from "@phoenix/components/agent/PxiGlyph";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { DRAWER_DEFAULT_MIN_SIZE } from "@phoenix/components/core/overlay/constants";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";
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
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "trace-details",
  });

  // if we are focused on a particular span, use that as the subjectId
  // otherwise, use the traceId
  const paginationSubjectId = selectedSpanNodeId || traceId;

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
                <TraceDetailsPaginator currentId={paginationSubjectId} />
                <DialogTitle>
                  <TitleWithID title="Trace" id={traceId as string} />
                </DialogTitle>
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
    </Drawer>
  );
}
