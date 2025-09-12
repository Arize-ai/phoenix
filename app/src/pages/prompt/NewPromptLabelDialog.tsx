import { graphql, useMutation } from "react-relay";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { LabelParams, NewLabelForm } from "@phoenix/components/label";
import { NewPromptLabelDialogMutation } from "@phoenix/pages/prompt/__generated__/NewPromptLabelDialogMutation.graphql";
export function NewPromptLabelDialog() {
  const [addLabel, isSubmitting] = useMutation<NewPromptLabelDialogMutation>(
    graphql`
      mutation NewPromptLabelDialogMutation($label: CreatePromptLabelInput!) {
        createPromptLabel(input: $label) {
          query {
            ...PromptLabelConfigButton_labels
          }
        }
      }
    `
  );
  const onSubmit = (label: LabelParams) => {
    addLabel({
      variables: { label },
      onCompleted: () => {
        alert("Yay");
      },
      onError: () => {
        alert("noo");
      },
    });
  };
  return (
    <ModalOverlay isOpen>
      <Modal>
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Prompt Label</DialogTitle>
            </DialogHeader>
            <NewLabelForm onSubmit={onSubmit} isSubmitting={isSubmitting} />
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
