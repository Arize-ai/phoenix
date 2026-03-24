import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";

/**
 * Confirmation dialog shown before deleting an agent session.
 *
 * @param isOpen - whether the dialog is currently visible
 * @param onOpenChange - called when the dialog requests open-state change
 * @param onConfirmDelete - called when the user confirms deletion
 * @param sessionSummary - human-readable display name of the session to delete
 */
export type DeleteSessionDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirmDelete: () => void;
  sessionSummary: string;
};

export function DeleteSessionDialog({
  isOpen,
  onOpenChange,
  onConfirmDelete,
  sessionSummary,
}: DeleteSessionDialogProps) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete session</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Flex direction="column" gap="size-100">
                <Text>
                  This session and its messages will be permanently deleted.
                </Text>
                {sessionSummary && (
                  <Text weight="heavy">&ldquo;{sessionSummary}&rdquo;</Text>
                )}
              </Flex>
            </View>
            <DialogFooter>
              <Button size="S" onPress={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="S" onPress={onConfirmDelete}>
                Delete session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
