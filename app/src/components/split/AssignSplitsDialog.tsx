import { useEffect, useState } from "react";

import {
  Button,
  Dialog,
  Flex,
  Label,
  ListBox,
  ListBoxItem,
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
} from "@phoenix/components/dialog";

type AssignSplitsDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  splits: Array<{ id: string; name: string }>;
  defaultSelectedIds?: string[];
  onConfirm: (selectedIds: string[]) => void;
};

export function AssignSplitsDialog(props: AssignSplitsDialogProps) {
  const { isOpen, onOpenChange, splits, defaultSelectedIds = [], onConfirm } = props;
  const [selectedSplitIds, setSelectedSplitIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setSelectedSplitIds(new Set(defaultSelectedIds));
    }
  }, [isOpen, defaultSelectedIds]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedSplitIds(new Set());
        }
        onOpenChange(open);
      }}
      isDismissable
    >
      <Modal>
        <Dialog aria-label="Assign Splits">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Splits</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                <View>
                  <Label>Select splits</Label>
                  <ListBox
                    aria-label="Dataset splits"
                    selectionMode="multiple"
                    selectedKeys={Array.from(selectedSplitIds)}
                    onSelectionChange={(keys) => {
                      if (keys === "all") {
                        setSelectedSplitIds(new Set(splits.map((s) => s.id)));
                      } else {
                        setSelectedSplitIds(
                          new Set(Array.from(keys as Iterable<unknown>).map(String))
                        );
                      }
                    }}
                  >
                    {splits.map((split) => (
                      <ListBoxItem key={split.id} id={split.id}>
                        {split.name}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </View>
              </Flex>
            </View>
            <View
              paddingEnd="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              borderTopColor="light"
              borderTopWidth="thin"
            >
              <Flex direction="row" justifyContent="end" gap="size-100">
                <Button size="S" onPress={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="S"
                  onPress={() => {
                    onConfirm(Array.from(selectedSplitIds));
                    onOpenChange(false);
                  }}
                >
                  Assign
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}


