import { Suspense } from "react";
import { useNavigate, useParams, useRouteLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Dialog, Drawer, Flex, Loading } from "@phoenix/components";
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
import type { projectEvaluatorDetailsLoader } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsLoader";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { TraceDetails } from "@phoenix/pages/trace/TraceDetails";

export const PROJECT_EVALUATOR_DETAILS_ROUTE_ID = "projectEvaluatorDetails";

/**
 * A single evaluator trace, opened over the evaluator's Traces tab.
 */
export function ProjectEvaluatorTracePage() {
  const { traceId, projectEvaluatorId } = useParams();
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const loaderData = useRouteLoaderData<typeof projectEvaluatorDetailsLoader>(
    PROJECT_EVALUATOR_DETAILS_ROUTE_ID
  );
  const projectId = loaderData?.traceProjectId;
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "evaluator-trace-details",
  });

  invariant(traceId, "traceId is required");
  invariant(projectEvaluatorId, "projectEvaluatorId is required");
  // The trace lives in the evaluator's own trace project, which is created with
  // the evaluator -- so reaching this route without it is not possible.
  invariant(projectId, "traceProjectId is required");

  return (
    <Drawer
      isOpen
      onClose={() => navigate(paths.details(projectEvaluatorId))}
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
                <DialogTitle>Trace Details</DialogTitle>
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
              <TraceDetails traceId={traceId} projectId={projectId} />
            </Suspense>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
