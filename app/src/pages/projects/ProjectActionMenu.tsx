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
import { RemoveProjectDataForm } from "./RemoveProjectDataForm";
enum ProjectAction {
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
  const [dialog, setDialog] = useState<ReactNode>(null);
  const canDelete = projectName !== "default";
  const [commitDelete] = useMutation<ProjectActionMenuDeleteMutation>(graphql`
    mutation ProjectActionMenuDeleteMutation($projectId: GlobalID!) {
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
    setDialog(
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
                setDialog(null);
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
    setDialog(
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
                setDialog(null);
              }}
            >
              Clear
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  }, [handleClear, projectName]);

  const onRemoveData = useCallback(() => {
    setDialog(
      <Dialog size="M" title="Remove Data">
        <RemoveProjectDataForm
          projectId={projectId}
          onComplete={() => {
            onProjectRemoveData();
            setDialog(null);
          }}
        />
      </Dialog>
    );
  }, [onProjectRemoveData, projectId]);

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
            case ProjectAction.REMOVE_DATA: {
              return onRemoveData();
            }
          }
        }}
        disabledKeys={canDelete ? [] : [ProjectAction.DELETE]}
      >
        <Item key={ProjectAction.CLEAR} textValue="Clear Traces">
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
        <Item key={ProjectAction.REMOVE_DATA} textValue="Remove Data">
          <Flex
            direction={"row"}
            gap="size-75"
            justifyContent={"start"}
            alignItems={"center"}
          >
            <Icon svg={<Icons.CloseCircleOutline />} />
            <Text>Remove Data</Text>
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
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </div>
  );
}
