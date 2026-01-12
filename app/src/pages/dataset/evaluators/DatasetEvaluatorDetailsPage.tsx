import { Suspense } from "react";
import { DialogTrigger } from "react-aria-components";
import { useNavigate, useParams } from "react-router";

import { Loading, Modal, ModalOverlay } from "@phoenix/components";

import { DatasetEvaluatorDetailsDialog } from "./DatasetEvaluatorDetailsDialog";

/**
 * Show the details of a dataset evaluator in a slideover modal.
 */
export function DatasetEvaluatorDetailsPage() {
  const { evaluatorId, datasetId } = useParams();
  const navigate = useNavigate();
  return (
    <DialogTrigger
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate(`/datasets/${datasetId}/evaluators`);
        }
      }}
    >
      <ModalOverlay>
        <Modal variant="slideover" size="L">
          <Suspense fallback={<Loading />}>
            <DatasetEvaluatorDetailsDialog
              evaluatorId={evaluatorId as string}
              datasetId={datasetId as string}
            />
          </Suspense>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
