import { ConnectionHandler, graphql, useMutation } from "react-relay";

import { Dialog, Modal } from "@phoenix/components";
import {
  type DatasetSplitParams,
  NewDatasetSplitForm,
} from "@phoenix/components/datasetSplit/NewDatasetSplitForm";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { NewDatasetSplitDialogCreateSplitMutation } from "./__generated__/NewDatasetSplitDialogCreateSplitMutation.graphql";
import type { NewDatasetSplitDialogCreateSplitWithExamplesMutation } from "./__generated__/NewDatasetSplitDialogCreateSplitWithExamplesMutation.graphql";

type NewDatasetSplitDialogProps = {
  onCompleted?: () => void;
  exampleIds?: string[];
};

export function NewDatasetSplitDialog(props: NewDatasetSplitDialogProps) {
  const { onCompleted, exampleIds } = props;
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [
    commitCreateDatasetSplitWithExamples,
    isCommittingCreateDatasetSplitWithExamples,
  ] = useMutation<NewDatasetSplitDialogCreateSplitWithExamplesMutation>(graphql`
    mutation NewDatasetSplitDialogCreateSplitWithExamplesMutation(
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
  `);

  const [createDatasetSplit, isCommittingCreateDatasetSplit] =
    useMutation<NewDatasetSplitDialogCreateSplitMutation>(graphql`
      mutation NewDatasetSplitDialogCreateSplitMutation(
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

  const onSubmit = (params: DatasetSplitParams) => {
    const trimmed = params.name.trim();
    const connections = [
      ConnectionHandler.getConnectionID(
        "client:root",
        "ManageDatasetSplitsDialog_datasetSplits"
      ),
    ];

    // TODO: Validate params
    if (!trimmed) return;

    if (exampleIds) {
      commitCreateDatasetSplitWithExamples({
        variables: {
          connections,
          input: {
            name: trimmed,
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
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Failed to create split",
            message: formattedError?.[0] ?? error.message,
          });
        },
      });
    } else {
      createDatasetSplit({
        variables: {
          connections,
          input: {
            name: trimmed,
            description: params.description || null,
            color: params.color,
            metadata: null,
          },
        },
        onCompleted: () => {
          notifySuccess({
            title: "Split created",
            message: `Created split "${trimmed}"`,
          });
          onCompleted?.();
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Failed to create split",
            message: formattedError?.[0] ?? error.message,
          });
        },
      });
    }
  };

  return (
    <Modal size="S">
      <Dialog aria-label="Create dataset split">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Dataset Split</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton />
            </DialogTitleExtra>
          </DialogHeader>
          <NewDatasetSplitForm
            onSubmit={onSubmit}
            isSubmitting={
              isCommittingCreateDatasetSplit ||
              isCommittingCreateDatasetSplitWithExamples
            }
          />
        </DialogContent>
      </Dialog>
    </Modal>
  );
}
