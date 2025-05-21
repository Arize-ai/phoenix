import { ReactNode } from "react";
import { Blocker } from "react-router";

import { Dialog, DialogContainer } from "@arizeai/components";

import { Button, Flex, Text, View } from "@phoenix/components";

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
  if (blocker.state === "blocked") {
    return (
      <DialogContainer
        type="modal"
        isDismissable={true}
        onDismiss={() => blocker.reset()}
      >
        <Dialog title={"Confirm Navigation"} size="S">
          <View padding="size-200">
            <Text>{message}</Text>
          </View>
          <ConfirmNavigationDialogFooter blocker={blocker} />
        </Dialog>
      </DialogContainer>
    );
  }
}
