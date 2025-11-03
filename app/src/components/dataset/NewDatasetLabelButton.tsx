import { useState } from "react";
import type { DataID } from "react-relay";

import { Button, DialogTrigger, Icon, Icons } from "@phoenix/components";
import { Modal, ModalOverlay } from "@phoenix/components/overlay";

import { NewDatasetLabelDialog } from "./NewDatasetLabelDialog";

type NewDatasetLabelButtonProps = {
  /**
   * Optional Relay connection IDs to update. These must be connections of DatasetLabelEdge types.
   */
  updateConnectionIds?: DataID[];
};

export function NewDatasetLabelButton(props: NewDatasetLabelButtonProps) {
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
            updateConnectionIds={props.updateConnectionIds}
            onCompleted={() => setShowNewDatasetLabelDialog(false)}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
