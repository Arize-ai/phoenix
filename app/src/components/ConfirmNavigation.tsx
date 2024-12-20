import React, { ReactNode } from "react";
import { Blocker } from "react-router";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Text,
  View,
} from "@arizeai/components";

function ConfirmNavigationDialogFooter({ blocker }: { blocker: Blocker }) {
  return (
    <View padding={"size-100"} borderTopColor={"dark"} borderTopWidth={"thin"}>
      <Flex justifyContent={"end"} gap={"size-100"}>
        <Button
          variant={"default"}
          onClick={() => blocker.reset && blocker.reset()}
          size={"compact"}
        >
          Cancel
        </Button>
        <Button
          variant={"primary"}
          onClick={() => blocker.proceed && blocker.proceed()}
          size={"compact"}
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
          <View padding={"size-200"}>
            <Text>{message}</Text>
          </View>
          <ConfirmNavigationDialogFooter blocker={blocker} />
        </Dialog>
      </DialogContainer>
    );
  }
}
