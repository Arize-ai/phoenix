import { Suspense } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from "react-router";
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
import { ErrorBoundary } from "@phoenix/components/exception";
import { ShareLinkButton } from "@phoenix/components/ShareLinkButton";
import type { projectEvaluatorCompareLoader } from "@phoenix/pages/project/evaluators/projectEvaluatorCompareLoader";
import { SessionDetails } from "@phoenix/pages/trace/SessionDetails";
import { TraceDetails } from "@phoenix/pages/trace/TraceDetails";
import { clearSelectionScopedParams } from "@phoenix/utils/urlUtils";

export const PROJECT_EVALUATOR_COMPARE_ROUTE_ID = "projectEvaluatorCompare";

/**
 * A matching target, opened over the comparison table.
 */
export function ProjectEvaluatorCompareTargetPage() {
  const { targetId, projectId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const loaderData = useRouteLoaderData<typeof projectEvaluatorCompareLoader>(
    PROJECT_EVALUATOR_COMPARE_ROUTE_ID
  );
  const isSession = loaderData?.evaluationTarget === "SESSION";
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "evaluator-compare-details",
  });

  invariant(targetId, "targetId is required");
  invariant(projectId, "projectId is required");

  return (
    <Drawer
      isOpen
      onClose={() =>
        navigate(
          { pathname: "..", search: clearSelectionScopedParams(search) },
          { relative: "route", replace: true }
        )
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
                <DialogTitle>
                  {isSession ? "Session Details" : "Trace Details"}
                </DialogTitle>
              </Flex>
              <DialogTitleExtra>
                <ShareLinkButton
                  preserveSearchParams
                  buttonText="Share"
                  tooltipText="Copy details link to clipboard"
                  successText="Details link copied to clipboard"
                />
              </DialogTitleExtra>
            </DialogHeader>
            <ErrorBoundary>
              <Suspense key={targetId} fallback={<Loading />}>
                {isSession ? (
                  <SessionDetails sessionId={targetId} />
                ) : (
                  <TraceDetails traceId={targetId} projectId={projectId} />
                )}
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
