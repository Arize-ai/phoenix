import {
  Button,
  ButtonProps,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";

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

export type RunExperimentButtonProps = RunExperimentCodeDialogProps &
  Pick<ButtonProps, "variant" | "size">;

/**
 * A button that opens a dialog with code examples for running experiments
 * on a dataset via the Python or TypeScript SDK.
 */
export function RunExperimentButton({
  datasetName,
  datasetId,
  version,
  variant = "default",
  size = "S",
}: RunExperimentButtonProps) {
  return (
    <DialogTrigger>
      <Button
        size={size}
        variant={variant}
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
      >
        Experiment
      </Button>
      <ExperimentCodeModal
        datasetName={datasetName}
        datasetId={datasetId}
        version={version}
      />
    </DialogTrigger>
  );
}
