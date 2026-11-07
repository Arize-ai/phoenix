import type { ReactNode } from "react";

import {
  Alert,
  Button,
  Dialog,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";

/**
 * The confirmation for an action that clears queued evaluations: clearing a
 * project's queue, or turning off an evaluator that has work waiting.
 */
export function ClearQueueConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
  isPending = false,
  error = null,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  error?: string | null;
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            {error ? (
              <View paddingX="size-200" paddingTop="size-100">
                <Alert variant="danger" banner>
                  {error}
                </Alert>
              </View>
            ) : null}
            <View padding="size-200">{children}</View>
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
                  onPress={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="S"
                  onPress={onConfirm}
                  isDisabled={isPending}
                  leadingVisual={
                    isPending ? <Icon svg={<Icons.Loading />} /> : undefined
                  }
                >
                  {confirmLabel}
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
