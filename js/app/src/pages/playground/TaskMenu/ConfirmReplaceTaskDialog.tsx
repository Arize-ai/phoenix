import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";

/**
 * Asked before a task with unsaved changes is replaced by another prompt,
 * evaluator or new draft chosen from the task menu.
 */
export function ConfirmReplaceTaskDialog({
  isOpen,
  onKeepEditing,
  onDiscard,
}: {
  isOpen: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onKeepEditing();
      }}
    >
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Discard task changes</DialogTitle>
            </DialogHeader>
            <View padding="size-200">
              <Text>
                This replaces the unsaved changes in this task. This cannot be
                undone.
              </Text>
            </View>
            <DialogFooter>
              <Button variant="default" onPress={onKeepEditing}>
                Keep editing
              </Button>
              <Button variant="danger" onPress={onDiscard}>
                Discard changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
