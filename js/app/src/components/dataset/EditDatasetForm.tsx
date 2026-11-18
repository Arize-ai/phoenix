import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { EditDatasetFormMutation } from "./__generated__/EditDatasetFormMutation.graphql";
import type { DatasetFormParams } from "./DatasetForm";
import { DatasetForm } from "./DatasetForm";
import type { DatasetLabel } from "./DatasetLabelPicker";
import { useSetDatasetLabels } from "./DatasetLabelPicker";

export function EditDatasetForm({
  datasetName,
  datasetId,
  datasetDescription,
  onDatasetEdited,
  datasetMetadata,
  datasetLabels,
}: {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  datasetLabels: readonly DatasetLabel[];
  onDatasetEdited: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSavingLabels, setIsSavingLabels] = useState(false);
  const { setDatasetLabels } = useSetDatasetLabels();
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

  const onSubmit = ({ labels, ...params }: DatasetFormParams) => {
    setError(null);
    const areLabelsChanged =
      labels.length !== datasetLabels.length ||
      labels.some((label, index) => label.id !== datasetLabels[index]?.id);
    commit({
      variables: {
        datasetId,
        ...params,
        metadata: JSON.parse(params.metadata),
      },
      onCompleted: () => {
        if (!areLabelsChanged) {
          onDatasetEdited();
          return;
        }
        setIsSavingLabels(true);
        setDatasetLabels({
          datasetId,
          labels,
          onSaved: () => {
            setIsSavingLabels(false);
            onDatasetEdited();
          },
          onFailed: (message) => {
            // the rest saved; the dialog stays open so the labels can be
            // saved again
            setIsSavingLabels(false);
            setError(`The labels were not saved: ${message}`);
          },
        });
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
      datasetLabels={datasetLabels}
      onSubmit={onSubmit}
      isSubmitting={isCommitting || isSavingLabels}
      submitButtonText={isCommitting || isSavingLabels ? "Saving..." : "Save"}
      formMode="edit"
      errorMessage={error}
    />
  );
}
