import { graphql, useMutation } from "react-relay";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { LabelParams, NewLabelForm } from "@phoenix/components/label";
import { NewPromptLabelDialogMutation } from "@phoenix/pages/prompt/__generated__/NewPromptLabelDialogMutation.graphql";

type NewPromptLabelDialogProps = {
  onCompleted: () => void;
  onError?: (error: Error) => void;
};
export function NewPromptLabelDialog(props: NewPromptLabelDialogProps) {
  const { onCompleted, onError } = props;
  const [addLabel, isSubmitting] = useMutation<NewPromptLabelDialogMutation>(
    graphql`
      mutation NewPromptLabelDialogMutation($label: CreatePromptLabelInput!) {
        createPromptLabel(input: $label) {
          __typename
        }
      }
    `
  );
  const onSubmit = (label: LabelParams) => {
    addLabel({
      variables: { label },
      onCompleted,
      onError,
    });
  };
  return (
    <ModalOverlay isOpen>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Prompt Label</DialogTitle>
              <DialogCloseButton />
            </DialogHeader>
            <NewLabelForm onSubmit={onSubmit} isSubmitting={isSubmitting} />
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
