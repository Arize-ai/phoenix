import { Modal, ModalOverlay } from "@phoenix/components";

import {
  RunExperimentCodeDialogContent,
  RunExperimentCodeDialogProps,
} from "./RunExperimentCodeDialog";

export type { RunExperimentCodeDialogProps as ExperimentCodeModalProps };

/**
 * A composable modal component for showing experiment code examples.
 * Use as a child of DialogTrigger alongside your button.
 *
 * @example
 * ```tsx
 * <DialogTrigger>
 *   <Button>Run Experiment</Button>
 *   <ExperimentCodeModal datasetId="123" datasetName="my-dataset" />
 * </DialogTrigger>
 * ```
 */
export function ExperimentCodeModal({
  datasetName,
  datasetId,
  version,
}: RunExperimentCodeDialogProps) {
  return (
    <ModalOverlay isDismissable>
      <Modal variant="slideover" size="L">
        <RunExperimentCodeDialogContent
          datasetName={datasetName}
          datasetId={datasetId}
          version={version}
        />
      </Modal>
    </ModalOverlay>
  );
}
