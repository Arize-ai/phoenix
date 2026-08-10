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
 * Why a slideover route cannot open what its URL names -- an evaluator of the
 * wrong kind, or one that no longer exists. Only a hand-written or stale link
 * reaches these, since the menus and the table link by kind.
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
