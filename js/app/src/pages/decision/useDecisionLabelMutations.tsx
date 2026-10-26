import { useCallback, useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import type { LabelParams } from "@phoenix/components/label";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { useDecisionLabelMutationsCreateLabelMutation } from "./__generated__/useDecisionLabelMutationsCreateLabelMutation.graphql";

/**
 * The Relay connections that hold decision labels. A newly created label is
 * prepended to each so it appears immediately wherever decision labels are listed
 * (the label picker and the settings table).
 */
function getDecisionLabelConnectionIds(): string[] {
  return [
    ConnectionHandler.getConnectionID(
      "client:root",
      "DecisionLabelConfigButtonAllLabels_decisionLabels"
    ),
    ConnectionHandler.getConnectionID(
      "client:root",
      "DecisionLabelsTable__decisionLabels"
    ),
  ];
}

/**
 * Owns the "create decision label" mutation and its Relay connection wiring,
 * shared by every decision-label creation surface. Mirrors
 * {@link useDatasetLabelMutations}.
 */
export const useDecisionLabelMutations = () => {
  const [error, setError] = useState("");

  const [createLabel, isSubmitting] =
    useMutation<useDecisionLabelMutationsCreateLabelMutation>(graphql`
      mutation useDecisionLabelMutationsCreateLabelMutation(
        $label: CreateDecisionLabelInput!
        $connections: [ID!]!
      ) {
        createDecisionLabel(input: $label) {
          decisionLabels
            @prependNode(
              connections: $connections
              edgeTypeName: "DecisionLabelEdge"
            ) {
            id
            name
            description
            color
            usageCount
          }
        }
      }
    `);

  const addLabelMutation = useCallback(
    (label: LabelParams, onCompleted: () => void) => {
      createLabel({
        variables: { label, connections: getDecisionLabelConnectionIds() },
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
