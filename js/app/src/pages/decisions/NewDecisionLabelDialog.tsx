import {
  Alert,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components";
import type { LabelParams } from "@phoenix/components/label";
import { NewLabelForm } from "@phoenix/components/label";
import { useDecisionLabelMutations } from "@phoenix/pages/decisions/useDecisionLabelMutations";

type NewDecisionLabelDialogProps = {
  onCompleted: () => void;
};
export function NewDecisionLabelDialog(props: NewDecisionLabelDialogProps) {
  const { onCompleted } = props;
  const { addLabelMutation, isSubmitting, error } = useDecisionLabelMutations();
  const onSubmit = (label: LabelParams) => {
    addLabelMutation(label, onCompleted);
  };
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Decision Label</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>
        {error ? (
          <Alert banner variant="danger">
            {error}
          </Alert>
        ) : null}
        <NewLabelForm onSubmit={onSubmit} isSubmitting={isSubmitting} />
      </DialogContent>
    </Dialog>
  );
}
