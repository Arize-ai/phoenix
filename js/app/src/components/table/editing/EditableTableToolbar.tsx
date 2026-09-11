import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  Button,
  Dialog,
  Flex,
  Icon,
  IconButton,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  Toolbar,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { FloatingToolbarContainer } from "@phoenix/components/core/toolbar/FloatingToolbarContainer";

import { EditableTableChangeSummary } from "./EditableTableChangeSummary";
import type { EditableTableStore } from "./editableTableStore";
import { getEditableTableChangeCounts } from "./editableTableStore";

// The reserved width fits all three summary segments, so the bar keeps its
// size as segments appear and disappear; tabular figures keep the counts from
// jittering as they tick.
const changeSummaryCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: var(--global-dimension-size-3000);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

export type EditableTableToolbarProps<Row extends object> = {
  store: EditableTableStore<Row>;
  /** The toolbar's accessible name, e.g. "Edit examples". */
  label: string;
  /** Called when the person asks to save, from the button or Cmd+S. */
  onSave: () => void;
  /**
   * Whether the consumer's own rules allow saving. The toolbar additionally
   * requires at least one pending change and no save in flight.
   */
  canSave?: boolean;
  saveLabel?: string;
  discardTitle: string;
  /**
   * Describes the pending changes for the discard confirmation, e.g.
   * "3 unsaved changes to the dataset examples".
   */
  describeUnsavedChanges: (args: { count: number }) => string;
  /** Shown beside the change summary, e.g. a validation warning. */
  summaryExtra?: ReactNode;
  /** Consumer actions, rendered between the summary and the Save button. */
  children?: ReactNode;
};

/**
 * The floating action bar shown while a table is in edit mode: cancel with a
 * discard confirmation, the change summary, the consumer's own actions, and
 * Save. Holds every action that ends or extends the edit session, so the
 * session reads as a distinct mode rather than a toolbar state.
 */
export function EditableTableToolbar<Row extends object>({
  store,
  label,
  onSave,
  canSave: consumerCanSave = true,
  saveLabel = "Save changes",
  discardTitle,
  describeUnsavedChanges,
  summaryExtra,
  children,
}: EditableTableToolbarProps<Row>) {
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const isSaving = useStore(store, (state) => state.mode === "saving");
  const counts = useStore(store, useShallow(getEditableTableChangeCounts));
  const changeCount = counts.added + counts.updated + counts.deleted;
  const canSave = consumerCanSave && changeCount > 0 && !isSaving;

  // Cmd+S / Ctrl+S saves. A dialog owns its own shortcuts — a cell's JSON
  // editor commits with Cmd+Enter — so the shortcut is ignored while one is
  // open. The discard confirmation is an alertdialog, so both roles match.
  useHotkeys(
    "mod+s",
    (event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[role="dialog"],[role="alertdialog"]')
      ) {
        return;
      }
      if (canSave) {
        onSave();
      }
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
    }
  );

  // Leaving edit mode with changes pending asks first.
  const cancelEditing = () => {
    if (changeCount > 0) {
      setIsDiscardDialogOpen(true);
    } else {
      store.getState().cancelEditing();
    }
  };

  return (
    <FloatingToolbarContainer>
      <Toolbar aria-label={label}>
        <View paddingEnd="size-100">
          <Flex direction="row" gap="size-100" alignItems="center">
            <TooltipTrigger>
              <IconButton
                size="M"
                isDisabled={isSaving}
                onPress={cancelEditing}
                aria-label="Cancel editing"
              >
                <Icon svg={<Icons.Close />} />
              </IconButton>
              <Tooltip>Cancel editing</Tooltip>
            </TooltipTrigger>
            <div css={changeSummaryCSS}>
              <EditableTableChangeSummary counts={counts} />
              {summaryExtra}
            </div>
          </Flex>
        </View>
        {children}
        <Button
          variant={changeCount > 0 ? "primary" : "default"}
          size="M"
          isDisabled={!canSave}
          leadingVisual={<Icon svg={<Icons.Save />} />}
          onPress={onSave}
        >
          {saveLabel}
        </Button>
      </Toolbar>
      <ModalOverlay
        isOpen={isDiscardDialogOpen}
        onOpenChange={setIsDiscardDialogOpen}
        isDismissable
      >
        <Modal size="S">
          {/* A destructive confirmation, not a plain dialog. */}
          <Dialog role="alertdialog">
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{discardTitle}</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text>
                  {`This will discard ${describeUnsavedChanges({
                    count: changeCount,
                  })}.`}
                </Text>
              </View>
              <DialogFooter>
                <Button variant="default" slot="close">
                  Keep editing
                </Button>
                <Button
                  variant="danger"
                  onPress={() => {
                    setIsDiscardDialogOpen(false);
                    store.getState().cancelEditing();
                  }}
                >
                  Discard changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </FloatingToolbarContainer>
  );
}
