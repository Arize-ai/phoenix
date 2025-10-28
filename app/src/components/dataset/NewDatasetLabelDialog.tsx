import {
  Alert,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components";
import {
  useDatasetLabelMutations,
  UseDatasetLabelMutationsParams,
} from "@phoenix/components/dataset/useDatasetLabelMutations";
import { NewLabelForm } from "@phoenix/components/label";

type NewDatasetLabelDialogProps = UseDatasetLabelMutationsParams;

export function NewDatasetLabelDialog(props: NewDatasetLabelDialogProps) {
  const { updateConnectionIds, datasetId } = props;
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
              addLabelMutation(label, () => close());
            }}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
