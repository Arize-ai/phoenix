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

import { ProjectActionMenuMutation } from "./__generated__/ProjectActionMenuMutation.graphql";

export function ProjectActionMenu({
  projectId,
  projectName,
  onProjectDelete,
}: {
  projectId: string;
  projectName: string;
  onProjectDelete: () => void;
}) {
  const [confirmDialog, setConfirmDialog] = useState<ReactNode>(null);
  const [commit] = useMutation<ProjectActionMenuMutation>(graphql`
    mutation ProjectActionMenuMutation($projectId: GlobalID!) {
      deleteProject(id: $projectId) {
        __typename
      }
    }
  `);
  const handleDelete = useCallback(() => {
    startTransition(() => {
      commit({
        variables: {
          projectId: projectId,
        },
      });

      onProjectDelete();
    });
  }, [commit, projectId, onProjectDelete]);

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
            <Button variant="danger" onClick={handleDelete}>
              Delete Project
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  }, [handleDelete, projectName]);

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
          switch (action) {
            case "deleteProject": {
              return onDelete();
            }
          }
        }}
      >
        <Item key={"deleteProject"}>
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
