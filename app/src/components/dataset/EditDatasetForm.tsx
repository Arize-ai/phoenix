import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { EditDatasetFormMutation } from "./__generated__/EditDatasetFormMutation.graphql";
import type { DatasetFormParams } from "./DatasetForm";
import { DatasetForm } from "./DatasetForm";

export function EditDatasetForm({
  datasetName,
  datasetId,
  datasetDescription,
  onDatasetEdited,
  datasetMetadata,
}: {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onDatasetEdited: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [commit, isCommitting] = useMutation<EditDatasetFormMutation>(graphql`
    mutation EditDatasetFormMutation(
      $datasetId: ID!
      $name: String!
      $description: String = null
      $metadata: JSON = null
    ) {
      patchDataset(
        input: {
          datasetId: $datasetId
          name: $name
          description: $description
          metadata: $metadata
        }
      ) {
        dataset {
          name
          description
          metadata
        }
      }
    }
  `);

  const onSubmit = (params: DatasetFormParams) => {
    setError(null);
    commit({
      variables: {
        datasetId,
        ...params,
        metadata: JSON.parse(params.metadata),
      },
      onCompleted: () => {
        onDatasetEdited();
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        setError(formattedError?.[0] ?? error.message);
      },
    });
  };

  return (
    <DatasetForm
      datasetName={datasetName}
      datasetDescription={datasetDescription}
      datasetMetadata={datasetMetadata}
      onSubmit={onSubmit}
      isSubmitting={isCommitting}
      submitButtonText={isCommitting ? "Saving..." : "Save"}
      formMode="edit"
      errorMessage={error}
    />
  );
}
