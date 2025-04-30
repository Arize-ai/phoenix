import React, { Suspense } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { Dialog, DialogContainer } from "@arizeai/components";

import { Loading } from "@phoenix/components";
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
  const selectedSpanNodeId = searchParams.get("selectedSpanNodeId");

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
        extra={<TraceDetailsPaginator currentId={paginationSubjectId} />}
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
