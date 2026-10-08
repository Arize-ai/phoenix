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

/**
 * Why a slideover route cannot open the evaluator its URL names -- one of the
 * wrong kind for the flow. Only a hand-written or stale link reaches this,
 * since the menus and the table link by kind. An id that resolves to nothing
 * throws out of the Relay query instead and is not handled here.
 */
export function ProjectEvaluatorSlideoverError({
  title,
  message,
  onOpenChange,
}: {
  title: string;
  message: string;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <ModalOverlay isOpen isDismissable onOpenChange={onOpenChange}>
      <Modal size="S">
        <Dialog aria-label={title}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Text>{message}</Text>
            </View>
            <DialogFooter>
              <Button slot="close">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
