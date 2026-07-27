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
 * Confirms an outside-click dismissal of an evaluator slideover that has
 * unsaved edits, so a stray click cannot silently drop work.
 */
export function DiscardEvaluatorChangesDialog({
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
        if (!open) {
          onKeepEditing();
        }
      }}
      isDismissable
    >
      <Modal size="S">
        <Dialog aria-label="Discard changes">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Discard changes</DialogTitle>
            </DialogHeader>
            <View padding="size-200">
              <Text>
                Closing this panel will discard your unsaved evaluator edits.
              </Text>
            </View>
            <DialogFooter>
              <Button onPress={onKeepEditing}>Keep editing</Button>
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
