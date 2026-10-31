import { useState } from "react";

import { Button, DialogTrigger, Icon, Icons } from "@phoenix/components";
import {
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components/core/overlay";

import { NewDecisionLabelDialog } from "./NewDecisionLabelDialog";

export function NewDecisionLabelButton() {
  const [showNewDecisionLabelDialog, setShowNewDecisionLabelDialog] =
    useState(false);
  return (
    <DialogTrigger>
      <Button
        size="S"
        variant="primary"
        leadingVisual={<Icon svg={<Icons.Plus />} />}
        onPress={() => setShowNewDecisionLabelDialog(true)}
      >
        New Label
      </Button>
      <ViewportModalOverlay
        isOpen={showNewDecisionLabelDialog}
        onOpenChange={setShowNewDecisionLabelDialog}
      >
        <ViewportModal size="S">
          <NewDecisionLabelDialog
            onCompleted={() => setShowNewDecisionLabelDialog(false)}
          />
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
