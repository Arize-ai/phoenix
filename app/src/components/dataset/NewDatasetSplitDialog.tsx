import { graphql, useMutation } from "react-relay";

import { Dialog, Modal } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import {
  NewSplitForm,
  type SplitParams,
} from "@phoenix/components/split/NewSplitForm";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { NewDatasetSplitDialogCreateSplitMutation } from "./__generated__/NewDatasetSplitDialogCreateSplitMutation.graphql";

type NewDatasetSplitDialogProps = {
  onCompleted?: () => void;
};

export function NewDatasetSplitDialog(props: NewDatasetSplitDialogProps) {
  const { onCompleted } = props;
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [commit, isInFlight] =
    useMutation<NewDatasetSplitDialogCreateSplitMutation>(graphql`
      mutation NewDatasetSplitDialogCreateSplitMutation(
        $input: CreateDatasetSplitInput!
      ) {
        createDatasetSplit(input: $input) {
          datasetSplit {
            id
            name
          }
        }
      }
    `);

  const onSubmit = (params: SplitParams) => {
    const trimmed = params.name.trim();
    if (!trimmed) return;
    commit({
      variables: {
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
          <NewSplitForm onSubmit={onSubmit} isSubmitting={isInFlight} />
        </DialogContent>
      </Dialog>
    </Modal>
  );
}
