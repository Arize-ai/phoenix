import { useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  IconButton,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  Toolbar,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { AnnotationConfigDialog } from "@phoenix/components/annotation/AnnotationConfigDialog";
import { FloatingToolbarContainer } from "@phoenix/components/core/toolbar/FloatingToolbarContainer";
import { useNotifySuccess } from "@phoenix/contexts";
import type { AnnotationConfig } from "@phoenix/pages/settings/types";

type PersistedAnnotationConfig = AnnotationConfig & { id: string };

interface AnnotationConfigSelectionToolbarProps {
  selectedConfigs: PersistedAnnotationConfig[];
  onClearSelection: () => void;
  onEditAnnotationConfig: (config: AnnotationConfig) => void;
  onDeleteAnnotationConfig: (
    configIds: string[],
    args?: {
      onCompleted?: () => void;
      onError?: (error: string) => void;
    }
  ) => void;
}

export const AnnotationConfigSelectionToolbar = ({
  selectedConfigs,
  onClearSelection,
  onEditAnnotationConfig,
  onDeleteAnnotationConfig,
}: AnnotationConfigSelectionToolbarProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const isPlural = selectedConfigs.length !== 1;
  const selectedConfig =
    selectedConfigs.length === 1 ? selectedConfigs[0] : null;

  const handleDelete = () => {
    setIsDeleting(true);
    onDeleteAnnotationConfig(
      selectedConfigs.map((config) => config.id),
      {
        onCompleted: () => {
          notifySuccess({
            title: `Annotation Config${isPlural ? "s" : ""} Deleted`,
            message: `${selectedConfigs.length} annotation config${isPlural ? "s" : ""} ${isPlural ? "have" : "has"} been deleted.`,
          });
          setIsDeleting(false);
          setIsDeleteDialogOpen(false);
          onClearSelection();
        },
        onError: (error) => {
          setDeleteError(error);
          setIsDeleting(false);
        },
      }
    );
  };

  return (
    <FloatingToolbarContainer>
      <Toolbar aria-label="Annotation config selection">
        <View paddingEnd="size-100">
          <Flex direction="row" gap="size-100" alignItems="center">
            <TooltipTrigger>
              <IconButton
                size="M"
                onPress={onClearSelection}
                aria-label="Clear selection"
              >
                <Icon svg={<Icons.Close />} />
              </IconButton>
              <Tooltip>Clear selection</Tooltip>
            </TooltipTrigger>
            <Text>{`${selectedConfigs.length} config${isPlural ? "s" : ""} selected`}</Text>
          </Flex>
        </View>
        {selectedConfig ? (
          <DialogTrigger onOpenChange={(open) => !open && onClearSelection()}>
            <Button size="M" leadingVisual={<Icon svg={<Icons.Edit />} />}>
              Edit
            </Button>
            <ModalOverlay>
              <Modal>
                <AnnotationConfigDialog
                  initialAnnotationConfig={selectedConfig}
                  onAddAnnotationConfig={onEditAnnotationConfig}
                />
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        ) : null}
        <Button
          variant="danger"
          size="M"
          leadingVisual={
            <Icon svg={isDeleting ? <Icons.Loading /> : <Icons.Trash />} />
          }
          isDisabled={isDeleting}
          onPress={() => setIsDeleteDialogOpen(true)}
          aria-label="Delete annotation configs"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </Toolbar>
      <ModalOverlay
        isOpen={isDeleteDialogOpen}
        onOpenChange={(isOpen) => {
          if (isOpen) setDeleteError(null);
          setIsDeleteDialogOpen(isOpen);
        }}
        isDismissable
      >
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{`Delete Annotation Config${isPlural ? "s" : ""}`}</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text color="danger">
                  {`Are you sure you want to delete ${selectedConfigs.length} annotation config${isPlural ? "s" : ""}? Annotations made with ${isPlural ? "these configs" : "this config"} will not be impacted.`}
                </Text>
                {deleteError ? (
                  <Alert variant="danger">{deleteError}</Alert>
                ) : null}
              </View>
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button size="S" onPress={() => setIsDeleteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="S"
                    onPress={handleDelete}
                    isDisabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </FloatingToolbarContainer>
  );
};
