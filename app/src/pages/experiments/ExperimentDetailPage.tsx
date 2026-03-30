import { Suspense } from "react";
import { DialogTrigger } from "react-aria-components";
import { useNavigate, useParams } from "react-router";

import { Loading, Modal, ModalOverlay } from "@phoenix/components";

import { ExperimentDetailsDialog } from "./ExperimentDetailsDialog";

/**
 * A page that shows the details of an experiment as a slide-over.
 */
export function ExperimentDetailPage() {
  const { experimentId, datasetId } = useParams();
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
            <ExperimentDetailsDialog experimentId={experimentId as string} />
          </Suspense>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
