import { Suspense } from "react";
import { useNavigate } from "react-router";

import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Loading,
  Tooltip,
  TooltipTrigger,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";

import { SpanToDatasetExampleDialog } from "./SpanToDatasetExampleDialog";

const ADD_TO_DATASET_LABEL = "Add to Dataset";

/**
 * Opens the dialog that adds a span to a dataset as an example. When
 * condensed the button shows only its icon, so a tooltip names it.
 */
export function AddSpanToDatasetButton({
  spanId,
  isCondensed,
}: {
  /**
   * The Global ID of the span
   */
  spanId: string;
  /**
   * Show only the icon, with the label in a tooltip
   */
  isCondensed: boolean;
}) {
  const notifySuccess = useNotifySuccess();
  const navigate = useNavigate();
  return (
    <DialogTrigger>
      <TooltipTrigger isDisabled={!isCondensed}>
        <Button
          variant="default"
          size="S"
          aria-label={ADD_TO_DATASET_LABEL}
          leadingVisual={<Icon svg={<Icons.Database />} />}
        >
          {isCondensed ? null : ADD_TO_DATASET_LABEL}
        </Button>
        <Tooltip>{ADD_TO_DATASET_LABEL}</Tooltip>
      </TooltipTrigger>
      <ViewportModalOverlay>
        <ViewportModal size="L">
          <Suspense fallback={<Loading />}>
            <SpanToDatasetExampleDialog
              spanId={spanId}
              onCompleted={(datasetId) => {
                notifySuccess({
                  title: "Span Added to Dataset",
                  message: "Successfully added span to dataset",
                  action: {
                    text: "View Dataset",
                    onClick: () => {
                      navigate(`/datasets/${datasetId}/examples`);
                    },
                  },
                });
              }}
            />
          </Suspense>
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
