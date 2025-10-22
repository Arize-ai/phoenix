import { useState } from "react";

import { Button, DialogTrigger, Icon, Icons } from "@phoenix/components";
import { Modal, ModalOverlay } from "@phoenix/components/overlay";

import { NewDatasetLabelDialog } from "./NewDatasetLabelDialog";

export function NewDatasetLabelButton() {
  const [showNewDatasetLabelDialog, setShowNewDatasetLabelDialog] =
    useState(false);
  return (
    <DialogTrigger>
      <Button
        size="S"
        variant="primary"
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        onPress={() => setShowNewDatasetLabelDialog(true)}
      >
        New Label
      </Button>
      <ModalOverlay
        isOpen={showNewDatasetLabelDialog}
        onOpenChange={setShowNewDatasetLabelDialog}
      >
        <Modal size="S">
          <NewDatasetLabelDialog
            onCompleted={() => setShowNewDatasetLabelDialog(false)}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
