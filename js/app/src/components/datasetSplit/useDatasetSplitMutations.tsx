import { useCallback } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import type { useDatasetSplitMutationsCreateSplitMutation } from "@phoenix/components/datasetSplit/__generated__/useDatasetSplitMutationsCreateSplitMutation.graphql";
import type { useDatasetSplitMutationsCreateSplitWithExamplesMutation } from "@phoenix/components/datasetSplit/__generated__/useDatasetSplitMutationsCreateSplitWithExamplesMutation.graphql";
import type { DatasetSplitParams } from "@phoenix/components/datasetSplit/NewDatasetSplitForm";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export const useDatasetSplitMutations = ({
  onCompleted,
  exampleIds,
  onError,
}: {
  onCompleted?: () => void;
  exampleIds?: string[];
  onError?: (message: string) => void;
}) => {
  const notifySuccess = useNotifySuccess();
  const [
    commitCreateDatasetSplitWithExamples,
    isCommittingCreateDatasetSplitWithExamples,
  ] = useMutation<useDatasetSplitMutationsCreateSplitWithExamplesMutation>(
    graphql`
      mutation useDatasetSplitMutationsCreateSplitWithExamplesMutation(
        $input: CreateDatasetSplitWithExamplesInput!
        $connections: [ID!]!
      ) {
        createDatasetSplitWithExamples(input: $input) {
          datasetSplit
            @prependNode(
              connections: $connections
              edgeTypeName: "DatasetSplitEdge"
            ) {
            id
            name
          }
          examples {
            id
            datasetSplits {
              id
              name
              color
            }
          }
        }
      }
    `
  );

  const [createDatasetSplit, isCommittingCreateDatasetSplit] =
    useMutation<useDatasetSplitMutationsCreateSplitMutation>(graphql`
      mutation useDatasetSplitMutationsCreateSplitMutation(
        $input: CreateDatasetSplitInput!
        $connections: [ID!]!
      ) {
        createDatasetSplit(input: $input) {
          datasetSplit
            @prependNode(
              connections: $connections
              edgeTypeName: "DatasetSplitEdge"
            ) {
            id
            name
          }
        }
      }
    `);

  const onSubmit = useCallback(
    (params: DatasetSplitParams) => {
      const trimmedSplitName = params.name.trim();
      const connections = [
        ConnectionHandler.getConnectionID(
          "client:root",
          "ManageDatasetSplitsDialog_datasetSplits"
        ),
      ];

      // TODO: Validate params
      if (!trimmedSplitName) return;

      if (exampleIds) {
        commitCreateDatasetSplitWithExamples({
          variables: {
            connections,
            input: {
              name: trimmedSplitName,
              description: params.description || null,
              color: params.color,
              metadata: null,
              exampleIds,
            },
          },
          onCompleted: () => {
            onCompleted?.();
          },
          onError: (error) => {
            const formattedError =
              getErrorMessagesFromRelayMutationError(error);
            onError?.(formattedError?.[0] ?? error.message);
          },
        });
      } else {
        createDatasetSplit({
          variables: {
            connections,
            input: {
              name: trimmedSplitName,
              description: params.description || null,
              color: params.color,
              metadata: null,
            },
          },
          onCompleted: () => {
            notifySuccess({
              title: "Split created",
              message: `Created split "${trimmedSplitName}"`,
            });
            onCompleted?.();
          },
          onError: (error) => {
            const formattedError =
              getErrorMessagesFromRelayMutationError(error);
            onError?.(formattedError?.[0] ?? error.message);
          },
        });
      }
    },
    [
      commitCreateDatasetSplitWithExamples,
      createDatasetSplit,
      exampleIds,
      onCompleted,
      onError,
      notifySuccess,
    ]
  );

  return {
    onSubmit,
    isCreatingDatasetSplit:
      isCommittingCreateDatasetSplitWithExamples ||
      isCommittingCreateDatasetSplit,
  };
};
