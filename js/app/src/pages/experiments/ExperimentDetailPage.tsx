import { Suspense } from "react";
import { DialogTrigger } from "react-aria-components";
import { useLocation, useNavigate, useParams } from "react-router";

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
  const { search } = useLocation();
  return (
    <DialogTrigger
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          navigate({ pathname: `/datasets/${datasetId}/experiments`, search });
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
