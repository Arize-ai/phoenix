import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";

/**
 * The trash icon on a version tag row and its confirmation dialog. The
 * caller owns the open state, runs the deletion and reports its error, which
 * the dialog shows while staying open.
 */
export function DeleteVersionTagButton({
  isOpen,
  onOpenChange,
  onDelete,
  isDeleting,
  /** The consequence of deleting, e.g. what can no longer be pulled by tag. */
  warning,
  error,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDelete: () => void;
  isDeleting: boolean;
  warning: string;
  error?: string | null;
}) {
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button
        aria-label="Delete tag"
        size="S"
        leadingVisual={<Icon svg={<Icons.Trash />} />}
      />
      <ModalOverlay>
        <Modal size="S">
          <Dialog>
            <DialogHeader>
              <DialogTitle>Delete Tag</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            {error ? (
              <Alert variant="danger" banner>
                {error}
              </Alert>
            ) : null}
            <View padding="size-200">
              <View paddingBottom="size-100">
                <Text color="danger" size="XS">
                  {warning}
                </Text>
              </View>
            </View>
            <View
              paddingX="size-200"
              paddingY="size-100"
              borderTopWidth="thin"
              borderColor="default"
            >
              <Flex gap="size-100" justifyContent="end">
                <Button size="S" onPress={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button variant="danger" size="S" onPress={onDelete}>
                  {isDeleting ? "Deleting..." : "Delete Tag"}
                </Button>
              </Flex>
            </View>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
