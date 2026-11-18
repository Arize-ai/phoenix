import { startTransition, useCallback, useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type {
  CreateDatasetFormMutation,
  CreateDatasetFormMutation$data,
} from "./__generated__/CreateDatasetFormMutation.graphql";
import type { DatasetFormParams } from "./DatasetForm";
import { DatasetForm } from "./DatasetForm";
import { useSetDatasetLabels } from "./DatasetLabelPicker";

export type CreateDatasetFormProps = {
  onDatasetCreated: (
    dataset: CreateDatasetFormMutation$data["createDataset"]["dataset"]
  ) => void | Promise<void>;
  onDatasetCreateError?: (error: Error) => void;
  onCancel?: () => void;
  submitButtonText?: string;
};

export function CreateDatasetForm({
  onDatasetCreated,
  onDatasetCreateError,
  onCancel,
  submitButtonText = "Create Dataset",
}: CreateDatasetFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAwaitingCreatedHandler, setIsAwaitingCreatedHandler] =
    useState(false);
  const [isSavingLabels, setIsSavingLabels] = useState(false);
  const { setDatasetLabels, error: labelsError } = useSetDatasetLabels();
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
    ({ labels, ...params }: DatasetFormParams) => {
      commit({
        variables: { ...params, metadata: JSON.parse(params.metadata) },
        onCompleted: (response) => {
          const dataset = response["createDataset"]["dataset"];
          const notifyCreated = () => {
            const handled = onDatasetCreated(dataset);
            if (handled) {
              setIsAwaitingCreatedHandler(true);
              handled.finally(() =>
                startTransition(() => setIsAwaitingCreatedHandler(false))
              );
            }
          };
          if (labels.length === 0) {
            notifyCreated();
            return;
          }
          // createDataset takes no labels, so they are attached once the
          // dataset exists
          setIsSavingLabels(true);
          setDatasetLabels({
            datasetId: dataset.id,
            labels,
            onSettled: () => {
              setIsSavingLabels(false);
              notifyCreated();
            },
          });
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
    [commit, onDatasetCreated, onDatasetCreateError, setDatasetLabels]
  );

  const isSubmitting =
    isCommitting || isSavingLabels || isAwaitingCreatedHandler;
  return (
    <DatasetForm
      isSubmitting={isSubmitting}
      onSubmit={onSubmit}
      submitButtonText={isSubmitting ? "Creating..." : submitButtonText}
      formMode="create"
      errorMessage={errorMessage ?? labelsError}
      onCancel={onCancel}
    />
  );
}
