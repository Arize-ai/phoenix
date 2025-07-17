import { Suspense } from "react";
import { DialogTrigger } from "react-aria-components";
import { useNavigate, useParams } from "react-router";

import { Loading, Modal, ModalOverlay } from "@phoenix/components";

import { ExampleDetailsDialog } from "./ExampleDetailsDialog";

/**
 * A page that shows the details of a dataset example.
 */
export function ExamplePage() {
  const { exampleId, datasetId } = useParams();
  const navigate = useNavigate();
  return (
    <DialogTrigger
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate(`/datasets/${datasetId}/examples`);
        }
      }}
    >
      <ModalOverlay>
        <Modal variant="slideover" size="L">
          <Suspense fallback={<Loading />}>
            <ExampleDetailsDialog exampleId={exampleId as string} />
          </Suspense>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
