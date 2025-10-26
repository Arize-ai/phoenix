import { useState } from "react";
import { type DataID, graphql, useMutation } from "react-relay";

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

import type { NewDatasetLabelDialogMutation } from "./__generated__/NewDatasetLabelDialogMutation.graphql";

type NewDatasetLabelDialogProps = {
  onCompleted?: () => void;
  /**
   * Optional Relay connection IDs to update. These must be connections of DatasetLabelEdge types.
   */
  updateConnectionIds?: DataID[];
  /**
   * Optional dataset ID. If provided, newly created labels will be auto-applied to the dataset upon creation.
   */
  datasetId?: string;
};
export function NewDatasetLabelDialog(props: NewDatasetLabelDialogProps) {
  const [error, setError] = useState("");
  const { onCompleted, updateConnectionIds, datasetId } = props;
  const [addLabel, isSubmitting] = useMutation<NewDatasetLabelDialogMutation>(
    graphql`
      mutation NewDatasetLabelDialogMutation(
        $input: CreateDatasetLabelInput!
        $connections: [ID!]!
      ) {
        createDatasetLabel(input: $input) {
          datasetLabel
            @prependNode(
              connections: $connections
              edgeTypeName: "DatasetLabelEdge"
            ) {
            id
            name
            color
          }
          datasets {
            id
            labels {
              id
              name
              color
            }
          }
        }
      }
    `
  );

  const onSubmit = (label: LabelParams) => {
    // Convert RGBA to hex format for backend
    const convertToHex = (color: string): string => {
      if (color.startsWith("#")) return color;

      const rgba = color.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
      );
      if (rgba) {
        const [, r, g, b] = rgba;
        const hex =
          "#" +
          [r, g, b]
            .map((x) => parseInt(x).toString(16).padStart(2, "0"))
            .join("");
        return hex;
      }

      return color; // fallback to original color
    };

    addLabel({
      variables: {
        input: {
          ...label,
          color: convertToHex(label.color),
          datasetIds: datasetId ? [datasetId] : undefined,
        },
        connections: updateConnectionIds ?? [],
      },
      onCompleted: () => {
        onCompleted?.();
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        setError(formattedError?.[0] ?? error.message);
      },
    });
  };
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
            onSubmit={(...args) => {
              onSubmit(...args);
              close();
            }}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
