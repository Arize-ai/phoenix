import React, {
  ReactNode,
  startTransition,
  useCallback,
  useState,
} from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogContainer,
  Icon,
  Icons,
  View,
} from "@arizeai/components";
import { ActionMenu, Flex, Item, Text } from "@arizeai/components";

import { ProjectActionMenuClearMutation } from "./__generated__/ProjectActionMenuClearMutation.graphql";
import { ProjectActionMenuDeleteMutation } from "./__generated__/ProjectActionMenuDeleteMutation.graphql";

enum ProjectAction {
  DELETE = "deleteProject",
  CLEAR = "clearProject",
}

export function ProjectActionMenu({
  projectId,
  projectName,
  onProjectDelete,
  onProjectClear,
}: {
  projectId: string;
  projectName: string;
  onProjectClear: () => void;
  onProjectDelete: () => void;
}) {
  const [confirmDialog, setConfirmDialog] = useState<ReactNode>(null);
  const canDelete = projectName !== "default";
  const [commitDelete] = useMutation<ProjectActionMenuDeleteMutation>(graphql`
    mutation ProjectActionMenuDeleteMutation($projectId: GlobalID!) {
      deleteProject(id: $projectId) {
        __typename
      }
    }
  `);
  const [commitClear] = useMutation<ProjectActionMenuClearMutation>(graphql`
    mutation ProjectActionMenuClearMutation($projectId: GlobalID!) {
      clearProject(id: $projectId) {
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
          projectId: projectId,
        },
      });

      onProjectClear();
    });
  }, [commitClear, projectId, onProjectClear]);

  const onDelete = useCallback(() => {
    setConfirmDialog(
      <Dialog size="S" title="Delete Project">
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
              onClick={() => {
                handleDelete();
                setConfirmDialog(null);
              }}
            >
              Delete Project
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  }, [handleDelete, projectName]);

  const onClear = useCallback(() => {
    setConfirmDialog(
      <Dialog size="S" title="Clear Project">
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
              onClick={() => {
                handleClear();
                setConfirmDialog(null);
              }}
            >
              Clear
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  }, [handleClear, projectName]);

  return (
    <div
      // TODO: add this logic to the ActionMenu component
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ActionMenu
        buttonVariant="quiet"
        align="end"
        onAction={(action) => {
          switch (action as ProjectAction) {
            case ProjectAction.DELETE: {
              return onDelete();
            }
            case ProjectAction.CLEAR: {
              return onClear();
            }
          }
        }}
        disabledKeys={canDelete ? [] : [ProjectAction.DELETE]}
      >
        <Item key={ProjectAction.CLEAR}>
          <Flex
            direction={"row"}
            gap="size-75"
            justifyContent={"start"}
            alignItems={"center"}
          >
            <Icon svg={<Icons.Refresh />} />
            <Text>Clear Data</Text>
          </Flex>
        </Item>
        {canDelete ? (
          <Item key={ProjectAction.DELETE}>
            <Flex
              direction={"row"}
              gap="size-75"
              justifyContent={"start"}
              alignItems={"center"}
            >
              <Icon svg={<Icons.TrashOutline />} />
              <Text>Delete</Text>
            </Flex>
          </Item>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (null as any)
        )}
      </ActionMenu>
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => setConfirmDialog(null)}
      >
        {confirmDialog}
      </DialogContainer>
    </div>
  );
}
