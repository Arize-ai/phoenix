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

import { NewDatasetLabelDialogMutation } from "./__generated__/NewDatasetLabelDialogMutation.graphql";

type NewDatasetLabelDialogProps = {
  onCompleted: () => void;
};
export function NewDatasetLabelDialog(props: NewDatasetLabelDialogProps) {
  const [error, setError] = useState("");
  const { onCompleted } = props;
  const [addLabel, isSubmitting] = useMutation<NewDatasetLabelDialogMutation>(
    graphql`
      mutation NewDatasetLabelDialogMutation(
        $label: CreateDatasetLabelInput!
        $connections: [ID!]!
      ) {
        createDatasetLabel(input: $label) {
          datasetLabel
            @prependNode(
              connections: $connections
              edgeTypeName: "DatasetLabelEdge"
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
        "DatasetLabelsTable__datasetLabels"
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
          <DialogTitle>New Dataset Label</DialogTitle>
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
