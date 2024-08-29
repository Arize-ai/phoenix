import React, { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

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
        onError: (error) => {
          // TODO(datasets): cleanup error handling to show human friendly error
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
