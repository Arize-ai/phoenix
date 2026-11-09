import { useStore } from "zustand";

import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Text,
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
import { getEditableTableChangeCount } from "@phoenix/store/editableTableStore";
import type { EditableTableStore } from "@phoenix/types/table";

/**
 * Asks before an edit session with pending changes is cancelled. Shared by
 * the edit toolbar's Cancel and any other control that ends the session, so
 * every way out says the same thing.
 */
export function DiscardEditsDialog<Row extends object>({
  store,
  isOpen,
  onOpenChange,
  title,
  describeUnsavedChanges,
}: {
  store: EditableTableStore<Row>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  /**
   * Describes the pending changes, e.g. "3 unsaved changes to the dataset
   * examples".
   */
  describeUnsavedChanges: (args: { count: number }) => string;
}) {
  const changeCount = useStore(store, getEditableTableChangeCount);

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal size="S">
        {/* A destructive confirmation, not a plain dialog. */}
        <Dialog role="alertdialog">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
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
                  onOpenChange(false);
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
  );
}
