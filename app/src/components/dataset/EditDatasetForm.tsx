import { graphql, useMutation } from "react-relay";

import { EditDatasetFormMutation } from "./__generated__/EditDatasetFormMutation.graphql";
import { DatasetForm, DatasetFormParams } from "./DatasetForm";

export function EditDatasetForm({
  datasetName,
  datasetId,
  datasetDescription,
  onDatasetEdited,
  onDatasetEditError,
  datasetMetadata,
}: {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onDatasetEdited: () => void;
  onDatasetEditError: (error: Error) => void;
}) {
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
        onDatasetEditError(error);
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
    />
  );
}
