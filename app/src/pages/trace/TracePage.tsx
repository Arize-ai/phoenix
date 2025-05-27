import { Suspense } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { Dialog, DialogContainer } from "@arizeai/components";

import { Flex, Loading } from "@phoenix/components";
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
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => {
        navigate(`${rootPath}/${tab}`);
      }}
    >
      <Dialog
        size="fullscreen"
        title="Trace Details"
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <TraceDetailsPaginator currentId={paginationSubjectId} />
            <ShareLinkButton
              preserveSearchParams
              buttonText="Share"
              tooltipText="Copy trace link to clipboard"
              successText="Trace link copied to clipboard"
            />
          </Flex>
        }
      >
        <Suspense fallback={<Loading />}>
          <TraceDetails
            // blow out state when the paginationSubjectId changes
            // some components are uncontrolled and will not update by themselves when the subjectId changes
            key={paginationSubjectId}
            traceId={traceId as string}
            projectId={projectId as string}
          />
        </Suspense>
      </Dialog>
    </DialogContainer>
  );
}
