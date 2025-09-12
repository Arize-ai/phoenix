import { useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import {
  Alert,
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
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type NewPromptLabelDialogProps = {
  onCompleted: () => void;
  onDismiss: () => void;
};
export function NewPromptLabelDialog(props: NewPromptLabelDialogProps) {
  const [error, setError] = useState("");
  const { onCompleted, onDismiss } = props;
  const [addLabel, isSubmitting] = useMutation<NewPromptLabelDialogMutation>(
    graphql`
      mutation NewPromptLabelDialogMutation(
        $label: CreatePromptLabelInput!
        $connections: [ID!]!
      ) {
        createPromptLabel(input: $label) {
          promptLabels
            @prependNode(
              connections: $connections
              edgeTypeName: "PromptLabelEdge"
            ) {
            id
            name
            color
          }
          query {
            ...PromptLabelConfigButton_allLabels
          }
        }
      }
    `
  );
  const onSubmit = (label: LabelParams) => {
    const connectionID = ConnectionHandler.getConnectionID(
      "client:root",
      "PromptLabelConfigButtonAllLabels_promptLabels"
    );
    addLabel({
      variables: { label, connections: [connectionID] },
      onCompleted,
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        setError(formattedError?.[0] ?? error.message);
      },
    });
  };
  return (
    <ModalOverlay
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onDismiss();
        }
      }}
    >
      <Modal size="S">
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
      </Modal>
    </ModalOverlay>
  );
}
