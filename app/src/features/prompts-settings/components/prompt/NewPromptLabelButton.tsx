import { useState } from "react";

import { Button, DialogTrigger, Icon, Icons } from "@phoenix/components";
import { Modal, ModalOverlay } from "@phoenix/components/overlay";

import { NewPromptLabelDialog } from "./NewPromptLabelDialog";

export function NewPromptLabelButton() {
  const [showNewPromptLabelDialog, setShowNewPromptLabelDialog] =
    useState(false);
  return (
    <DialogTrigger>
      <Button
        size="S"
        variant="primary"
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        onPress={() => setShowNewPromptLabelDialog(true)}
      >
        New Label
      </Button>
      <ModalOverlay
        isOpen={showNewPromptLabelDialog}
        onOpenChange={setShowNewPromptLabelDialog}
      >
        <Modal size="S">
          <NewPromptLabelDialog
            onCompleted={() => setShowNewPromptLabelDialog(false)}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
