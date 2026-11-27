import {
  useLocation,
  useNavigate,
  useParams,
  useResolvedPath,
  useSearchParams,
} from "react-router";
import invariant from "tiny-invariant";

import { Dialog, Drawer, Empty, Flex } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import {
  DRAWER_DEFAULT_MAX_SIZE,
  DRAWER_DEFAULT_MIN_SIZE,
  useDefaultDrawerSize,
} from "@phoenix/components/core/overlay";
import { ShareLinkButton } from "@phoenix/components/ShareLinkButton";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import {
  parseCompareTraceSlots,
  setCompareTraceSlotSelection,
} from "@phoenix/utils/traceSelectionUtils";
import {
  clearSelectionScopedParams,
  getTraceDetailsPath,
} from "@phoenix/utils/urlUtils";

import { CompareTraces } from "./CompareTraces";

/**
 * Shows two traces of the project side by side in a drawer over the traces or
 * spans table. The compared traces and each one's selected span live in the
 * URL, so the comparison can be reloaded and shared.
 */
export function CompareTracesPage() {
  const { projectId } = useParams();
  invariant(projectId, "projectId is required");
  const [searchParams, setSearchParams] = useSearchParams();
  const tabPath = useResolvedPath("..").pathname;
  const navigate = useNavigate();
  const location = useLocation();
  const { rootPath, tab } = useProjectRootPath();
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "compare-traces",
  });
  const slots = parseCompareTraceSlots(searchParams);
  const parentSearch = clearSelectionScopedParams(searchParams);

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
      // two full trace views need the room, so open as wide as allowed
      defaultSize={defaultSize ?? DRAWER_DEFAULT_MAX_SIZE}
      minSize={DRAWER_DEFAULT_MIN_SIZE}
      onResize={onSizeChange}
    >
      <Dialog>
        {({ close }) => (
          <DialogContent>
            <DialogHeader>
              <Flex direction="row" gap="size-200" alignItems="center">
                <DialogCloseButton close={close} />
                <DialogTitle>Compare Traces</DialogTitle>
              </Flex>
              <DialogTitleExtra>
                <ShareLinkButton
                  preserveSearchParams
                  buttonText="Share"
                  tooltipText="Copy compare link to clipboard"
                  successText="Compare link copied to clipboard"
                />
              </DialogTitleExtra>
            </DialogHeader>
            {slots.length < 2 ? (
              <Empty message="Select two traces to compare them side by side" />
            ) : (
              <CompareTraces
                projectId={projectId}
                traces={slots}
                // up to the tab route, keeping the time range and the span
                getTraceDetailsTo={(trace) =>
                  getTraceDetailsPath({
                    basePath: tabPath,
                    traceId: trace.traceId,
                    spanNodeId: trace.selectedSpanNodeId,
                    searchParams,
                  })
                }
                onSpanSelectionChange={(traceIndex, spanNodeId) => {
                  setSearchParams(
                    (searchParams) =>
                      setCompareTraceSlotSelection(
                        searchParams,
                        traceIndex,
                        spanNodeId
                      ),
                    { replace: true }
                  );
                }}
              />
            )}
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
