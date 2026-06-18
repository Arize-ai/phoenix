import { useCallback, useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import type { LabelParams } from "@phoenix/components/label";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { usePromptLabelMutationsCreateLabelMutation } from "./__generated__/usePromptLabelMutationsCreateLabelMutation.graphql";

/**
 * The Relay connections that hold prompt labels. A newly created label is
 * prepended to each so it appears immediately wherever prompt labels are listed
 * (the label picker and the settings table).
 */
function getPromptLabelConnectionIds(): string[] {
  return [
    ConnectionHandler.getConnectionID(
      "client:root",
      "PromptLabelConfigButtonAllLabels_promptLabels"
    ),
    ConnectionHandler.getConnectionID(
      "client:root",
      "PromptLabelsTable__promptLabels"
    ),
  ];
}

/**
 * Owns the "create prompt label" mutation and its Relay connection wiring,
 * shared by every prompt-label creation surface. Mirrors
 * {@link useDatasetLabelMutations}.
 */
export const usePromptLabelMutations = () => {
  const [error, setError] = useState("");

  const [createLabel, isSubmitting] =
    useMutation<usePromptLabelMutationsCreateLabelMutation>(graphql`
      mutation usePromptLabelMutationsCreateLabelMutation(
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
    `);

  const addLabelMutation = useCallback(
    (label: LabelParams, onCompleted: () => void) => {
      createLabel({
        variables: { label, connections: getPromptLabelConnectionIds() },
        onCompleted,
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setError(formattedError?.[0] ?? error.message);
        },
      });
    },
    [createLabel]
  );

  return { addLabelMutation, isSubmitting, error };
};
