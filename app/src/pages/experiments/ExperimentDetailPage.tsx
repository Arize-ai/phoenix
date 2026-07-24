import { Suspense } from "react";
import { DialogTrigger } from "react-aria-components";
import { useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Loading, Modal, ModalOverlay } from "@phoenix/components";

import { ExperimentDetailsDialog } from "./ExperimentDetailsDialog";

/**
 * A page that shows the details of an experiment as a slide-over.
 */
export function ExperimentDetailPage() {
  const { experimentId, datasetId } = useParams();
  invariant(experimentId, "experimentId is required by the route definition");
  const navigate = useNavigate();
  return (
    <DialogTrigger
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate(`/datasets/${datasetId}/experiments`);
        }
      }}
    >
      <ModalOverlay>
        <Modal variant="slideover" size="L">
          <Suspense fallback={<Loading />}>
            <ExperimentDetailsDialog experimentId={experimentId} />
          </Suspense>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
