import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import { useDatasetLabelMutationsAddLabelMutation } from "@phoenix/components/dataset/__generated__/useDatasetLabelMutationsAddLabelMutation.graphql";
import { LabelParams } from "@phoenix/components/label";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export type UseDatasetLabelMutationsParams = {
  /**
   * Optional Relay connection IDs to update. These must be connections of DatasetLabelEdge types.
   */
  updateConnectionIds?: string[];
  /**
   * Optional dataset ID. If provided, newly created labels will be auto-applied to the dataset upon creation.
   */
  datasetId?: string;
};

export const useDatasetLabelMutations = ({
  updateConnectionIds,
  datasetId,
}: UseDatasetLabelMutationsParams) => {
  const [error, setError] = useState("");

  const [addLabel, isSubmitting] =
    useMutation<useDatasetLabelMutationsAddLabelMutation>(graphql`
      mutation useDatasetLabelMutationsAddLabelMutation(
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
    `);

  const addLabelMutation = useCallback(
    (label: LabelParams, onCompleted: () => void) => {
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
    },
    [addLabel, updateConnectionIds, datasetId]
  );

  return {
    addLabelMutation,
    isSubmitting,
    error,
  };
};
