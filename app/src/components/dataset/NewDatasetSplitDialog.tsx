import { Dialog, Modal } from "@phoenix/components";
import { NewDatasetSplitForm } from "@phoenix/components/datasetSplit/NewDatasetSplitForm";
import { useDatasetSplitMutations } from "@phoenix/components/datasetSplit/useDatasetSplitMutations";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";

type NewDatasetSplitDialogProps = {
  onCompleted?: () => void;
  exampleIds?: string[];
};

export function NewDatasetSplitDialog(props: NewDatasetSplitDialogProps) {
  const { onCompleted, exampleIds } = props;
  const { onSubmit, isCreatingDatasetSplit } = useDatasetSplitMutations({
    onCompleted,
    exampleIds,
  });

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
            isSubmitting={isCreatingDatasetSplit}
          />
        </DialogContent>
      </Dialog>
    </Modal>
  );
}
