import { useCallback, useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type {
  CreateDatasetFormMutation,
  CreateDatasetFormMutation$data,
} from "./__generated__/CreateDatasetFormMutation.graphql";
import type { DatasetFormParams } from "./DatasetForm";
import { DatasetForm } from "./DatasetForm";

export type CreateDatasetFormProps = {
  onDatasetCreated: (
    dataset: CreateDatasetFormMutation$data["createDataset"]["dataset"]
  ) => void;
  onDatasetCreateError?: (error: Error) => void;
  onCancel?: () => void;
};

export function CreateDatasetForm({
  onDatasetCreated,
  onDatasetCreateError,
  onCancel,
}: CreateDatasetFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commit, isCommitting] = useMutation<CreateDatasetFormMutation>(graphql`
    mutation CreateDatasetFormMutation(
      $name: String!
      $description: String = null
      $metadata: JSON = null
    ) {
      createDataset(
        input: { name: $name, description: $description, metadata: $metadata }
      ) {
        dataset {
          id
          name
          ...DatasetSelect_dataset
        }
      }
    }
  `);
  const onSubmit = useCallback(
    (params: DatasetFormParams) => {
      commit({
        variables: { ...params, metadata: JSON.parse(params.metadata) },
        onCompleted: (response) => {
          onDatasetCreated(response["createDataset"]["dataset"]);
        },
        updater: (store) => {
          // Add the new dataset to the list of datasets
          const connectionId = ConnectionHandler.getConnectionID(
            "client:root",
            "DatasetPicker__datasets"
          );
          const payload = store.getRootField("createDataset");
          const dataset = payload.getLinkedRecord("dataset");
          const connectionRecord = store.get(connectionId);
          if (connectionRecord && dataset) {
            const newEdge = ConnectionHandler.createEdge(
              store,
              connectionRecord,
              dataset,
              "DatasetEdge"
            );
            ConnectionHandler.insertEdgeAfter(connectionRecord, newEdge);
          }
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setErrorMessage(formattedError?.[0] ?? error.message);
          onDatasetCreateError?.(error);
        },
      });
    },
    [commit, onDatasetCreated, onDatasetCreateError]
  );

  return (
    <DatasetForm
      isSubmitting={isCommitting}
      onSubmit={onSubmit}
      submitButtonText={isCommitting ? "Creating..." : "Create Dataset"}
      formMode="create"
      errorMessage={errorMessage}
      onCancel={onCancel}
    />
  );
}
