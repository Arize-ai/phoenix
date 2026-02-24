import {
  Alert,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components";
import { NewLabelForm } from "@phoenix/components/label";
import type { UseDatasetLabelMutationsParams } from "@phoenix/features/datasets/components/dataset/useDatasetLabelMutations";
import { useDatasetLabelMutations } from "@phoenix/features/datasets/components/dataset/useDatasetLabelMutations";

type NewDatasetLabelDialogProps = UseDatasetLabelMutationsParams & {
  onCompleted: () => void;
};

export function NewDatasetLabelDialog(props: NewDatasetLabelDialogProps) {
  const { updateConnectionIds, datasetId, onCompleted } = props;
  const { addLabelMutation, isSubmitting, error } = useDatasetLabelMutations({
    updateConnectionIds,
    datasetId,
  });

  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Dataset Label</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          {error ? (
            <Alert banner variant="danger">
              {error}
            </Alert>
          ) : null}
          <NewLabelForm
            onSubmit={(label) => {
              addLabelMutation(label, () => {
                onCompleted();
                close();
              });
            }}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
