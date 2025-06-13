import { useState } from "react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
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

export function DeleteAPIKeyButton({
  handleDelete,
}: {
  handleDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="danger"
        size="S"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        aria-label="Delete System Key"
        onPress={() => setIsOpen(true)}
      />
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <ModalOverlay isDismissable>
          <Modal>
            <Dialog>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete API Key</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton close={() => setIsOpen(false)} />
                  </DialogTitleExtra>
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
                  <Flex direction="row" justifyContent="end" gap="size-100">
                    <Button onPress={() => setIsOpen(false)} size="S">
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onPress={() => {
                        handleDelete();
                        setIsOpen(false);
                      }}
                      size="S"
                    >
                      Delete Key
                    </Button>
                  </Flex>
                </View>
              </DialogContent>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </>
  );
}
