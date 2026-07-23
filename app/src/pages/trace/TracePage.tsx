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
import { DRAWER_DEFAULT_MIN_SIZE } from "@phoenix/components/core/overlay/constants";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";
import { ShareLinkButton } from "@phoenix/components/ShareLinkButton";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { TraceDetailsPaginator } from "@phoenix/pages/trace/TraceDetailsPaginator";
import { withSearchParams } from "@phoenix/utils/urlUtils";

import { TraceDetails } from "./TraceDetails";

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
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "trace-details",
  });

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
                  {/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- traceId is a required route param */}
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
                // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- traceId is a required route param
                traceId={traceId as string}
                // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- projectId is a required route param
                projectId={projectId as string}
              />
            </Suspense>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
