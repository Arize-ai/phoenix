import { useState } from "react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";

function DeleteAPIKeyDialog({ handleDelete }: { handleDelete: () => void }) {
  return (
    <ModalOverlay isDismissable>
      <Modal>
        <Dialog>
          {({ close }) => (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete API key</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text>
                  This cannot be undone and will disable all uses of this key.
                </Text>
              </View>
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button slot="close" size="S">
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onPress={() => {
                      close();
                      handleDelete();
                    }}
                    size="S"
                  >
                    Delete API key
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export function DeleteAPIKeyButton({
  handleDelete,
  isDisabled,
  trigger = "button",
  apiKeyName,
}: {
  handleDelete: () => void;
  isDisabled?: boolean;
  trigger?: "button" | "menu";
  apiKeyName?: string;
}) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (trigger === "menu") {
    return (
      <>
        <MenuTrigger>
          <Button
            size="S"
            isDisabled={isDisabled}
            leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
            aria-label={`Actions for ${apiKeyName ?? "API key"}`}
          />
          <Popover placement="bottom end">
            <Menu
              onAction={(action) => {
                if (action === "delete") {
                  setIsDeleteDialogOpen(true);
                }
              }}
            >
              <MenuItem id="delete" textValue="Delete API key">
                <Flex
                  direction="row"
                  gap="size-75"
                  justifyContent="start"
                  alignItems="center"
                >
                  <Icon svg={<Icons.Trash />} />
                  <Text>Delete API key</Text>
                </Flex>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
        <DialogTrigger
          isOpen={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <DeleteAPIKeyDialog handleDelete={handleDelete} />
        </DialogTrigger>
      </>
    );
  }

  return (
    <DialogTrigger>
      <Button
        variant="danger"
        size="S"
        isDisabled={isDisabled}
        leadingVisual={<Icon svg={<Icons.Trash />} />}
        aria-label="Delete API key"
      />
      <DeleteAPIKeyDialog handleDelete={handleDelete} />
    </DialogTrigger>
  );
}
