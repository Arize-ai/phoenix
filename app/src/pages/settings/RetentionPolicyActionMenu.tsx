import React, { ReactNode, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import { ActionMenu, Dialog, DialogContainer, Item } from "@arizeai/components";

import { Button, Flex, Icon, Icons, Text, View } from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";

enum RetentionPolicyAction {
  EDIT = "editPolicy",
  DELETE = "deletePolicy",
}

export interface RetentionPolicyActionMenuProps {
  policyId: string;
  policyName: string;
  /**
   * The names of the projects associated with the policy.
   */
  projectNames: string[];
  onPolicyEdit: () => void;
  onPolicyDelete: () => void;
}

export const RetentionPolicyActionMenu = ({
  policyId,
  policyName,
  projectNames,
  onPolicyEdit,
  onPolicyDelete,
}: RetentionPolicyActionMenuProps) => {
  const [dialog, setDialog] = useState<ReactNode>(null);

  const onEdit = useCallback(() => {
    onPolicyEdit();
  }, [onPolicyEdit]);

  const [deletePolicy, isDeleting] = useMutation(graphql`
    mutation RetentionPolicyActionMenuDeletePolicyMutation(
      $input: DeleteProjectTraceRetentionPolicyInput!
    ) {
      deleteProjectTraceRetentionPolicy(input: $input) {
        query {
          ...RetentionPoliciesTable_policies
        }
      }
    }
  `);

  const onDelete = useCallback(() => {
    setDialog(
      <Dialog size="S" title="Delete Retention Policy">
        <View padding="size-200">
          <Text color="danger">
            {`Are you sure you want to delete retention policy "${policyName}"? This cannot be undone.`}
          </Text>
          <br />
          {projectNames.length > 0 && (
            <Text color="danger">
              {`This policy is associated with the following projects: ${projectNames.join(
                ", "
              )}. These projects will fall back to the default policy`}
            </Text>
          )}
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
              size="S"
              onPress={() => {
                deletePolicy({
                  variables: {
                    input: {
                      id: policyId,
                    },
                  },
                });
                setDialog(null);
                onPolicyDelete();
              }}
              leadingVisual={
                isDeleting ? <Icon svg={<Icons.LoadingOutline />} /> : undefined
              }
            >
              {isDeleting ? "Deleting..." : "Delete Policy"}
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  }, [
    policyId,
    policyName,
    projectNames,
    deletePolicy,
    onPolicyDelete,
    isDeleting,
  ]);

  return (
    <StopPropagation>
      <ActionMenu
        buttonVariant="quiet"
        buttonSize="compact"
        align="end"
        onAction={(action) => {
          switch (action as RetentionPolicyAction) {
            case RetentionPolicyAction.EDIT: {
              return onEdit();
            }
            case RetentionPolicyAction.DELETE: {
              return onDelete();
            }
          }
        }}
      >
        <Item key={RetentionPolicyAction.EDIT} textValue="Edit Policy">
          <Flex
            direction="row"
            gap="size-75"
            justifyContent="start"
            alignItems="center"
          >
            <Icon svg={<Icons.EditOutline />} />
            <Text>Edit</Text>
          </Flex>
        </Item>
        <Item key={RetentionPolicyAction.DELETE} textValue="Delete Policy">
          <Flex
            direction="row"
            gap="size-75"
            justifyContent="start"
            alignItems="center"
          >
            <Icon svg={<Icons.TrashOutline />} />
            <Text>Delete</Text>
          </Flex>
        </Item>
      </ActionMenu>
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </StopPropagation>
  );
};
