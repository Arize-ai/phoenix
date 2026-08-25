import { useState } from "react";

import { Button, DialogTrigger, Icon, Icons } from "@phoenix/components";
import {
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components/core/overlay";

import { NewPromptLabelDialog } from "./NewPromptLabelDialog";

export function NewPromptLabelButton() {
  const [showNewPromptLabelDialog, setShowNewPromptLabelDialog] =
    useState(false);
  return (
    <DialogTrigger>
      <Button
        size="S"
        variant="primary"
        leadingVisual={<Icon svg={<Icons.Plus />} />}
        onPress={() => setShowNewPromptLabelDialog(true)}
      >
        New Label
      </Button>
      <ViewportModalOverlay
        isOpen={showNewPromptLabelDialog}
        onOpenChange={setShowNewPromptLabelDialog}
      >
        <ViewportModal size="S">
          <NewPromptLabelDialog
            onCompleted={() => setShowNewPromptLabelDialog(false)}
          />
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
