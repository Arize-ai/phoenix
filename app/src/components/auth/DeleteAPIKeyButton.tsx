import { ReactNode, useState } from "react";

import {
  Button,
  Dialog,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/dialog";

export function DeleteAPIKeyButton({
  handleDelete,
}: {
  handleDelete: () => void;
}) {
  const [dialog, setDialog] = useState<ReactNode>(null);

  const onDelete = () => {
    setDialog(
      <Dialog>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
          </DialogHeader>
          <View padding="size-200">
            <Text color="danger">
              {`Are you sure you want to delete this key? This cannot be undone and will disable all uses of this key.`}
            </Text>
          </View>
          <View
            paddingEnd="size-200"
            paddingTop="size-100"
            paddingBottom="size-100"
            borderTopColor="light"
            borderTopWidth="thin"
          >
            <Flex direction="row" justifyContent="end">
              <Button
                variant="danger"
                onPress={() => {
                  handleDelete();
                  setDialog(null);
                }}
              >
                Delete Key
              </Button>
            </Flex>
          </View>
        </DialogContent>
      </Dialog>
    );
  };
  return (
    <>
      <Button
        variant="danger"
        size="S"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        aria-label="Delete System Key"
        onPress={onDelete}
      />
      {dialog}
    </>
  );
}
