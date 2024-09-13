import React, { ReactNode, useState } from "react";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@arizeai/components";

export function DeleteAPIKeyButton({
  handleDelete,
}: {
  handleDelete: () => void;
}) {
  const [dialog, setDialog] = useState<ReactNode>(null);

  const onDelete = () => {
    setDialog(
      <Dialog title="Delete API Key">
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
              onClick={() => {
                handleDelete();
                setDialog(null);
              }}
            >
              Delete Key
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  };
  return (
    <>
      <Button
        variant="danger"
        size="compact"
        icon={<Icon svg={<Icons.TrashOutline />} />}
        aria-label="Delete System Key"
        onClick={onDelete}
      />
      <DialogContainer
        isDismissable
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}
