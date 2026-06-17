import { useState } from "react";
import type { ReactNode } from "react";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
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
 * A danger-styled button that requires explicit confirmation before running an
 * irreversible action. The trigger shows `buttonText`; pressing it opens a modal that
 * states the consequence and runs `onConfirm` only after the user confirms.
 */
export function ConfirmButton({
  buttonText,
  buttonAriaLabel,
  title,
  message,
  confirmText = "Confirm",
  isDisabled,
  onConfirm,
}: {
  buttonText?: string;
  buttonAriaLabel?: string;
  title: string;
  message: ReactNode;
  confirmText?: string;
  isDisabled?: boolean;
  onConfirm: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        size="S"
        variant="danger"
        isDisabled={isDisabled}
        aria-label={buttonAriaLabel}
        leadingVisual={<Icon svg={<Icons.Trash />} />}
      >
        {buttonText}
      </Button>
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text color="danger">{message}</Text>
              </View>
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button
                    size="S"
                    variant="default"
                    onPress={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="S"
                    variant="danger"
                    onPress={() => {
                      setIsOpen(false);
                      onConfirm();
                    }}
                  >
                    {confirmText}
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
