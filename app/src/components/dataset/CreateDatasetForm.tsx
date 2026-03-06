import { useCallback, useEffect } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import type {
  CreateDatasetFormMutation,
  CreateDatasetFormMutation$data,
} from "./__generated__/CreateDatasetFormMutation.graphql";
import type { DatasetFormHandle, DatasetFormParams } from "./DatasetForm";
import { DatasetForm } from "./DatasetForm";

export type CreateDatasetFormProps = {
  onDatasetCreated: (
    dataset: CreateDatasetFormMutation$data["createDataset"]["dataset"]
  ) => void;
  onDatasetCreateError: (error: Error) => void;
  ref?: React.Ref<DatasetFormHandle>;
  onValidChange?: (isValid: boolean) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
};

export function CreateDatasetForm({
  onDatasetCreated,
  onDatasetCreateError,
  ref,
  onValidChange,
  onSubmittingChange,
}: CreateDatasetFormProps) {
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
          onDatasetCreateError(error);
        },
      });
    },
    [commit, onDatasetCreated, onDatasetCreateError]
  );
  useEffect(() => {
    onSubmittingChange?.(isCommitting);
  }, [isCommitting, onSubmittingChange]);

  return (
    <DatasetForm
      ref={ref}
      isSubmitting={isCommitting}
      onSubmit={onSubmit}
      submitButtonText={isCommitting ? "Creating..." : "Create Dataset"}
      formMode="create"
      onValidChange={onValidChange}
      hideFooter={!!ref}
    />
  );
}
