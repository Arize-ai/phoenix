import { startTransition, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

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
} from "@phoenix/components/dialog";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useNotifySuccess } from "@phoenix/contexts";

import { ProjectActionMenuClearMutation } from "./__generated__/ProjectActionMenuClearMutation.graphql";
import { ProjectActionMenuDeleteMutation } from "./__generated__/ProjectActionMenuDeleteMutation.graphql";
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
  const canDelete = projectName !== "default";
  const [commitDelete] = useMutation<ProjectActionMenuDeleteMutation>(graphql`
    mutation ProjectActionMenuDeleteMutation($projectId: ID!) {
      deleteProject(id: $projectId) {
        __typename
      }
    }
  `);
  const [commitClear] = useMutation<ProjectActionMenuClearMutation>(graphql`
    mutation ProjectActionMenuClearMutation($input: ClearProjectInput!) {
      clearProject(input: $input) {
        __typename
      }
    }
  `);
  const handleDelete = useCallback(() => {
    startTransition(() => {
      commitDelete({
        variables: {
          projectId: projectId,
        },
      });

      onProjectDelete();
    });
  }, [commitDelete, projectId, onProjectDelete]);

  const handleClear = useCallback(() => {
    startTransition(() => {
      commitClear({
        variables: {
          input: {
            id: projectId,
          },
        },
        onCompleted: () => {
          onProjectClear();
        },
        onError: (error) => {
          alert("Failed to clear project: " + error);
        },
      });
    });
  }, [commitClear, projectId, onProjectClear]);

  const onDelete = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const onClear = useCallback(() => {
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
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
        />
        <Popover>
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
                <Icon svg={<Icons.ClipboardCopy />} />
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
                <Icon svg={<Icons.CloseCircleOutline />} />
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
                  <Icon svg={<Icons.TrashOutline />} />
                  <Text>Delete</Text>
                </Flex>
              </MenuItem>
            ) : null}
          </Menu>
        </Popover>
      </MenuTrigger>
      <DialogTrigger
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <ModalOverlay>
          <Modal size="M">
            <Dialog>
              {({ close }) => (
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Project</DialogTitle>
                    <DialogTitleExtra>
                      <DialogCloseButton slot="close" />
                    </DialogTitleExtra>
                  </DialogHeader>
                  <View padding="size-200">
                    <Text color="danger">
                      {`Are you sure you want to delete project ${projectName}? This cannot be undone.`}
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
                          close();
                        }}
                      >
                        Delete Project
                      </Button>
                    </Flex>
                  </View>
                </DialogContent>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
      <DialogTrigger isOpen={showClearDialog} onOpenChange={setShowClearDialog}>
        <ModalOverlay>
          <Modal size="M">
            <Dialog>
              {({ close }) => (
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Clear Project</DialogTitle>
                    <DialogTitleExtra>
                      <DialogCloseButton slot="close" />
                    </DialogTitleExtra>
                  </DialogHeader>
                  <View padding="size-200">
                    <Text color="danger">
                      {`Are you sure you want to clear project ${projectName}? All traces and evaluations for this project will be deleted. This cannot be undone.`}
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
                          handleClear();
                          close();
                        }}
                      >
                        Clear
                      </Button>
                    </Flex>
                  </View>
                </DialogContent>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
      <DialogTrigger
        isOpen={showRemoveDataDialog}
        onOpenChange={setShowRemoveDataDialog}
      >
        <ModalOverlay>
          <Modal size="M">
            <Dialog>
              {({ close }) => (
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Remove Data</DialogTitle>
                    <DialogTitleExtra>
                      <DialogCloseButton slot="close" />
                    </DialogTitleExtra>
                  </DialogHeader>
                  <RemoveProjectDataForm
                    projectId={projectId}
                    onComplete={() => {
                      onProjectRemoveData();
                      close();
                    }}
                  />
                </DialogContent>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </StopPropagation>
  );
}
