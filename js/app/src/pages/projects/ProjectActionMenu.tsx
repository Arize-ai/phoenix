import { startTransition, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
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
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useNotifySuccess } from "@phoenix/contexts";
import { getMutationErrorMessage } from "@phoenix/utils/errorUtils";

import type { ProjectActionMenuClearMutation } from "./__generated__/ProjectActionMenuClearMutation.graphql";
import type { ProjectActionMenuDeleteMutation } from "./__generated__/ProjectActionMenuDeleteMutation.graphql";
import { RemoveProjectDataForm } from "./RemoveProjectDataForm";

enum ProjectAction {
  COPY_NAME = "copyName",
  DELETE = "deleteProject",
  CLEAR = "clearProject",
  REMOVE_DATA = "removeProjectData",
}

export function ProjectActionMenu({
  projectId,
  projectName,
  onProjectDelete,
  onProjectClear,
  onProjectRemoveData,
}: {
  projectId: string;
  projectName: string;
  onProjectClear: () => void;
  onProjectRemoveData: () => void;
  onProjectDelete: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showRemoveDataDialog, setShowRemoveDataDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const canDelete = projectName !== "default";
  const [commitDelete, isDeleting] =
    useMutation<ProjectActionMenuDeleteMutation>(graphql`
      mutation ProjectActionMenuDeleteMutation($projectId: ID!) {
        deleteProject(id: $projectId) {
          __typename
        }
      }
    `);
  const [commitClear, isClearing] =
    useMutation<ProjectActionMenuClearMutation>(graphql`
      mutation ProjectActionMenuClearMutation($input: ClearProjectInput!) {
        clearProject(input: $input) {
          __typename
        }
      }
    `);
  const handleDelete = useCallback(() => {
    setDeleteError(null);
    startTransition(() => {
      commitDelete({
        variables: {
          projectId: projectId,
        },
        onCompleted: () => {
          setShowDeleteDialog(false);
          onProjectDelete();
        },
        onError: (error) => {
          setDeleteError(getMutationErrorMessage(error));
        },
      });
    });
  }, [commitDelete, projectId, onProjectDelete]);

  const handleClear = useCallback(() => {
    setClearError(null);
    startTransition(() => {
      commitClear({
        variables: {
          input: {
            id: projectId,
          },
        },
        onCompleted: () => {
          setShowClearDialog(false);
          onProjectClear();
        },
        onError: (error) => {
          setClearError(getMutationErrorMessage(error));
        },
      });
    });
  }, [commitClear, projectId, onProjectClear]);

  const onDelete = useCallback(() => {
    setDeleteError(null);
    setShowDeleteDialog(true);
  }, []);

  const onClear = useCallback(() => {
    setClearError(null);
    setShowClearDialog(true);
  }, []);

  const onRemoveData = useCallback(() => {
    setShowRemoveDataDialog(true);
  }, []);

  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
        />
        <Popover placement="bottom end">
          <Menu
            aria-label="Project Actions Menu"
            onAction={(action) => {
              switch (action as ProjectAction) {
                case ProjectAction.COPY_NAME: {
                  navigator.clipboard.writeText(projectName);
                  notifySuccess({
                    title: "Project name copied to clipboard",
                  });
                  return;
                }
                case ProjectAction.DELETE: {
                  return onDelete();
                }
                case ProjectAction.CLEAR: {
                  return onClear();
                }
                case ProjectAction.REMOVE_DATA: {
                  return onRemoveData();
                }
              }
            }}
            disabledKeys={canDelete ? [] : [ProjectAction.DELETE]}
          >
            <MenuItem id={ProjectAction.COPY_NAME} textValue="Copy Name">
              <Flex
                direction={"row"}
                gap="size-75"
                justifyContent={"start"}
                alignItems={"center"}
              >
                <Icon svg={<Icons.Duplicate />} />
                <Text>Copy Name</Text>
              </Flex>
            </MenuItem>
            <MenuItem id={ProjectAction.CLEAR} textValue="Clear All Traces">
              <Flex
                direction={"row"}
                gap="size-75"
                justifyContent={"start"}
                alignItems={"center"}
              >
                <Icon svg={<Icons.Refresh />} />
                <Text>Clear All Data</Text>
              </Flex>
            </MenuItem>
            <MenuItem id={ProjectAction.REMOVE_DATA} textValue="Remove Data">
              <Flex
                direction={"row"}
                gap="size-75"
                justifyContent={"start"}
                alignItems={"center"}
              >
                <Icon svg={<Icons.CloseCircle />} />
                <Text>Remove Data</Text>
              </Flex>
            </MenuItem>
            {canDelete ? (
              <MenuItem id={ProjectAction.DELETE}>
                <Flex
                  direction={"row"}
                  gap="size-75"
                  justifyContent={"start"}
                  alignItems={"center"}
                >
                  <Icon svg={<Icons.Trash />} />
                  <Text>Delete</Text>
                </Flex>
              </MenuItem>
            ) : null}
          </Menu>
        </Popover>
      </MenuTrigger>
      <ModalOverlay
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Project</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              {deleteError ? (
                <View paddingX="size-200" paddingTop="size-100">
                  <Alert variant="danger" banner>
                    {deleteError}
                  </Alert>
                </View>
              ) : null}
              <View padding="size-200">
                <Text color="danger">
                  {`Are you sure you want to delete project ${projectName}? This cannot be undone.`}
                </Text>
              </View>
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex direction="row" justifyContent="end">
                  <Button
                    variant="danger"
                    isDisabled={isDeleting}
                    leadingVisual={
                      isDeleting ? <Icon svg={<Icons.Loading />} /> : undefined
                    }
                    onPress={handleDelete}
                  >
                    Delete Project
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
      <ModalOverlay isOpen={showClearDialog} onOpenChange={setShowClearDialog}>
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear Project</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              {clearError ? (
                <View paddingX="size-200" paddingTop="size-100">
                  <Alert variant="danger" banner>
                    {clearError}
                  </Alert>
                </View>
              ) : null}
              <View padding="size-200">
                <Text color="danger">
                  {`Are you sure you want to clear project ${projectName}? All traces and evaluations for this project will be deleted. This cannot be undone.`}
                </Text>
              </View>
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex direction="row" justifyContent="end">
                  <Button
                    variant="danger"
                    isDisabled={isClearing}
                    leadingVisual={
                      isClearing ? <Icon svg={<Icons.Loading />} /> : undefined
                    }
                    onPress={handleClear}
                  >
                    Clear
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
      <ModalOverlay
        isOpen={showRemoveDataDialog}
        onOpenChange={setShowRemoveDataDialog}
      >
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove Data</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <RemoveProjectDataForm
                projectId={projectId}
                onComplete={() => {
                  onProjectRemoveData();
                  setShowRemoveDataDialog(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </StopPropagation>
  );
}
