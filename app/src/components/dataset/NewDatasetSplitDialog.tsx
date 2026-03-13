import { useState } from "react";

import { Alert, Dialog, Modal } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { NewDatasetSplitForm } from "@phoenix/components/datasetSplit/NewDatasetSplitForm";
import { useDatasetSplitMutations } from "@phoenix/components/datasetSplit/useDatasetSplitMutations";

type NewDatasetSplitDialogProps = {
  onCompleted?: () => void;
  exampleIds?: string[];
};

export function NewDatasetSplitDialog(props: NewDatasetSplitDialogProps) {
  const { onCompleted, exampleIds } = props;
  const [error, setError] = useState<string | null>(null);
  const { onSubmit, isCreatingDatasetSplit } = useDatasetSplitMutations({
    onCompleted,
    exampleIds,
    onError: setError,
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
          {error && <Alert variant="danger">{error}</Alert>}
          <NewDatasetSplitForm
            onSubmit={onSubmit}
            isSubmitting={isCreatingDatasetSplit}
          />
        </DialogContent>
      </Dialog>
    </Modal>
  );
}
