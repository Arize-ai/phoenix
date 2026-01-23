import { Suspense } from "react";
import { useNavigate, useParams, useRouteLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Dialog,
  Flex,
  Loading,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { ShareLinkButton } from "@phoenix/components/ShareLinkButton";
import { TraceDetails } from "@phoenix/pages/trace/TraceDetails";

import { datasetEvaluatorDetailsLoader } from "./datasetEvaluatorDetailsLoader";

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

  invariant(traceId, "traceId is required");
  invariant(projectId, "projectId is required");
  invariant(datasetId, "datasetId is required");
  invariant(evaluatorId, "evaluatorId is required");

  return (
    <ModalOverlay
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate(`/datasets/${datasetId}/evaluators/${evaluatorId}`);
        }
      }}
    >
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <DialogContent>
              <DialogHeader>
                <Flex direction="row" gap="size-200" justifyContent="center">
                  <DialogTitle>Trace Details</DialogTitle>
                </Flex>
                <DialogTitleExtra>
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
                <TraceDetails traceId={traceId} projectId={projectId} />
              </Suspense>
            </DialogContent>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
