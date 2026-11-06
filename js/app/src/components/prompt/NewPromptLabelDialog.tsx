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
import { usePromptLabelMutations } from "@phoenix/components/prompt/usePromptLabelMutations";

type NewPromptLabelDialogProps = {
  onCompleted: () => void;
};
export function NewPromptLabelDialog(props: NewPromptLabelDialogProps) {
  const { onCompleted } = props;
  const { addLabelMutation, isSubmitting, error } = usePromptLabelMutations();
  const onSubmit = (label: LabelParams) => {
    addLabelMutation(label, onCompleted);
  };
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Prompt Label</DialogTitle>
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
