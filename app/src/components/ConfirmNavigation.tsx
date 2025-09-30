import { ReactNode } from "react";
import { Blocker } from "react-router";

import {
  Button,
  Dialog,
  Flex,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";

function ConfirmNavigationDialogFooter({ blocker }: { blocker: Blocker }) {
  return (
    <View padding={"size-100"} borderTopColor={"dark"} borderTopWidth={"thin"}>
      <Flex justifyContent={"end"} gap={"size-100"}>
        <Button onPress={() => blocker.reset && blocker.reset()} size="S">
          Cancel
        </Button>
        <Button
          variant="primary"
          onPress={() => blocker.proceed && blocker.proceed()}
          size="S"
        >
          Confirm
        </Button>
      </Flex>
    </View>
  );
}

export function ConfirmNavigationDialog({
  blocker,
  message = "Are you sure you want to leave the page? Some changes may not be saved.",
}: {
  blocker: Blocker;
  message?: ReactNode;
}) {
  return (
    <ModalOverlay isDismissable={false} isOpen={blocker.state === "blocked"}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Navigation</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton close={() => blocker.reset?.()} />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Text>{message}</Text>
            </View>
            <ConfirmNavigationDialogFooter blocker={blocker} />
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
