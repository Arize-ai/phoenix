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
import { TraceDetails } from "@phoenix/pages/trace/TraceDetails";

import type { datasetEvaluatorDetailsLoader } from "./datasetEvaluatorDetailsLoader";

export const EVALUATOR_DETAILS_ROUTE_ID = "evaluatorDetails";

/**
 * A component that shows the details of a trace within the dataset evaluator context
 */
export function EvaluatorTracePage() {
  const { traceId, datasetId, evaluatorId } = useParams();
  const navigate = useNavigate();
  const loaderData = useRouteLoaderData<typeof datasetEvaluatorDetailsLoader>(
    EVALUATOR_DETAILS_ROUTE_ID
  );
  const projectId = loaderData?.projectId;
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "evaluator-trace-details",
  });

  invariant(traceId, "traceId is required");
  invariant(projectId, "projectId is required");
  invariant(datasetId, "datasetId is required");
  invariant(evaluatorId, "evaluatorId is required");

  return (
    <Drawer
      isOpen
      onClose={() =>
        navigate(`/datasets/${datasetId}/evaluators/${evaluatorId}`)
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
