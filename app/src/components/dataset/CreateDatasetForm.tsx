import { useCallback } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import {
  CreateDatasetFormMutation,
  CreateDatasetFormMutation$data,
} from "./__generated__/CreateDatasetFormMutation.graphql";
import { DatasetForm, DatasetFormParams } from "./DatasetForm";

export type CreateDatasetFormProps = {
  onDatasetCreated: (
    dataset: CreateDatasetFormMutation$data["createDataset"]["dataset"]
  ) => void;
  onDatasetCreateError: (error: Error) => void;
};

export function CreateDatasetForm(props: CreateDatasetFormProps) {
  const { onDatasetCreated, onDatasetCreateError } = props;

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
          description
          metadata
          createdAt
          exampleCount
          experimentCount
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
  return (
    <DatasetForm
      isSubmitting={isCommitting}
      onSubmit={onSubmit}
      submitButtonText={isCommitting ? "Creating..." : "Create Dataset"}
      formMode="create"
    />
  );
}
