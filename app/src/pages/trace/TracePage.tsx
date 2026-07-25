import { Suspense } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import {
  Dialog,
  Drawer,
  Flex,
  Loading,
  TitleWithID,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { ShareLinkButton } from "@phoenix/components/ShareLinkButton";
import { TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS } from "@phoenix/constants";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { TraceDetailsPaginator } from "@phoenix/pages/trace/TraceDetailsPaginator";
import { withSearchParams } from "@phoenix/utils/urlUtils";

import { TraceDetails } from "./TraceDetails";
import { useDetailsPanelSizing } from "./useDetailsPanelSizing";

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TracePage() {
  const { traceId, projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { rootPath, tab } = useProjectRootPath();
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);
  const parentSearch = withSearchParams(searchParams, (params) => {
    params.delete(SELECTED_SPAN_NODE_ID_PARAM);
  });
  const {
    defaultDrawerSize,
    onDrawerSizeChange,
    onPreferredTreeWidthChange,
    preferredTreeWidth,
  } = useDetailsPanelSizing();

  // if we are focused on a particular span, use that as the subjectId
  // otherwise, use the traceId
  const paginationSubjectId = selectedSpanNodeId || traceId;

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
      defaultSize={defaultDrawerSize}
      minSize={TRACE_DETAILS_MIN_DRAWER_WIDTH_PIXELS}
      onResize={onDrawerSizeChange}
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
                preferredTreeWidth={preferredTreeWidth}
                onPreferredTreeWidthChange={onPreferredTreeWidthChange}
              />
            </Suspense>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
