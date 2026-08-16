import { Suspense } from "react";
import { DialogTrigger } from "react-aria-components";
import { useNavigate, useParams } from "react-router";

import {
  Loading,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";

import { ExperimentDetailsDialog } from "./ExperimentDetailsDialog";

/**
 * A page that shows the details of an experiment in a viewport modal.
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
      <ViewportModalOverlay>
        <ViewportModal size="L">
          <Suspense fallback={<Loading />}>
            <ExperimentDetailsDialog experimentId={experimentId as string} />
          </Suspense>
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
