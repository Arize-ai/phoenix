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

import type { NewDatasetLabelDialogMutation } from "./__generated__/NewDatasetLabelDialogMutation.graphql";

type NewDatasetLabelDialogProps = {
  onCompleted: () => void;
  /**
   * Optional connection IDs to update. If not provided, defaults to DatasetLabelsTable connection.
   */
  connections?: string[];
  /**
   * Optional dataset ID. If provided, newly created labels will be auto-applied to the dataset upon creation.
   */
  datasetId?: string;
};
export function NewDatasetLabelDialog(props: NewDatasetLabelDialogProps) {
  const [error, setError] = useState("");
  const { onCompleted, connections: providedConnections, datasetId } = props;
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

  const [setDatasetLabels] = useMutation(graphql`
    mutation NewDatasetLabelDialogSetLabelsMutation(
      $datasetIds: [ID!]!
      $datasetLabelIds: [ID!]!
      $currentDatasetId: ID!
    ) {
      setDatasetLabels(
        input: { datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds }
      ) {
        query {
          node(id: $currentDatasetId) {
            ... on Dataset {
              id
              labels {
                id
                name
                color
              }
            }
          }
        }
      }
    }
  `);
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

    const connections = providedConnections || [
      ConnectionHandler.getConnectionID(
        "client:root",
        "DatasetLabelsTable__datasetLabels"
      ),
      ConnectionHandler.getConnectionID(
        "client:root",
        "DatasetLabelFilterButton_datasetLabels"
      ),
      ConnectionHandler.getConnectionID(
        "client:root",
        "DatasetLabelConfigButtonAllLabels_datasetLabels"
      ),
    ];
    addLabel({
      variables: {
        label: {
          ...label,
          color: convertToHex(label.color),
        },
        connections,
      },
      onCompleted: (response) => {
        // Auto-apply the new label to the dataset if datasetId is provided
        if (datasetId && response.createDatasetLabel?.datasetLabel?.id) {
          setDatasetLabels({
            variables: {
              datasetIds: [datasetId],
              datasetLabelIds: [response.createDatasetLabel.datasetLabel.id],
              currentDatasetId: datasetId,
            },
            onCompleted: () => {
              onCompleted();
            },
            onError: () => {
              // Still call onCompleted even if auto-apply fails
              // The label was created successfully
              onCompleted();
            },
          });
        } else {
          onCompleted();
        }
      },
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
