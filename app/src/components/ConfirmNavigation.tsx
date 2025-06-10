import { ReactNode } from "react";
import { Blocker } from "react-router";

import { Button, Dialog, Flex, Text, View } from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  if (blocker.state === "blocked") {
    return (
      <Dialog>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Navigation</DialogTitle>
          </DialogHeader>
          <View padding="size-200">
            <Text>{message}</Text>
          </View>
          <ConfirmNavigationDialogFooter blocker={blocker} />
        </DialogContent>
      </Dialog>
    );
  }
}
