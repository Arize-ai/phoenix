import { useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import {
  Alert,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components";
import { LabelParams, NewLabelForm } from "@phoenix/components/label";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { NewPromptLabelDialogMutation } from "./__generated__/NewPromptLabelDialogMutation.graphql";

type NewPromptLabelDialogProps = {
  onCompleted: () => void;
};
export function NewPromptLabelDialog(props: NewPromptLabelDialogProps) {
  const [error, setError] = useState("");
  const { onCompleted } = props;
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
        }
      }
    `
  );
  const onSubmit = (label: LabelParams) => {
    const connections = [
      ConnectionHandler.getConnectionID(
        "client:root",
        "PromptLabelConfigButtonAllLabels_promptLabels"
      ),
      ConnectionHandler.getConnectionID(
        "client:root",
        "PromptLabelsTable__promptLabels"
      ),
    ];
    addLabel({
      variables: { label, connections },
      onCompleted,
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        setError(formattedError?.[0] ?? error.message);
      },
    });
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
