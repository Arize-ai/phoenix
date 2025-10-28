import { Suspense, useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import {
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
  Icons,
  Loading,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Text,
  View,
} from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";

import { EditRetentionPolicy } from "./EditRetentionPolicy";

const DEFAULT_POLICY_NAME = "Default";

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
  const canDelete = policyName !== DEFAULT_POLICY_NAME;
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const connectionId = ConnectionHandler.getConnectionID(
    "client:root",
    "RetentionPoliciesTable_projectTraceRetentionPolicies"
  );
  const [deletePolicy, isDeleting] = useMutation(graphql`
    mutation RetentionPolicyActionMenuDeletePolicyMutation(
      $policyId: ID!
      $connectionId: ID!
    ) {
      deleteProjectTraceRetentionPolicy(input: { id: $policyId }) {
        query {
          ...RetentionPoliciesTable_policies
        }
        node {
          id @deleteEdge(connections: [$connectionId])
        }
      }
    }
  `);

  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
        />
        <Popover>
          <Menu
            disabledKeys={canDelete ? [] : [RetentionPolicyAction.DELETE]}
            onAction={(action) => {
              switch (action as RetentionPolicyAction) {
                case RetentionPolicyAction.EDIT: {
                  return setShowEditDialog(true);
                }
                case RetentionPolicyAction.DELETE: {
                  return setShowDeleteDialog(true);
                }
              }
            }}
          >
            <MenuItem id={RetentionPolicyAction.EDIT} textValue="Edit Policy">
              <Flex
                direction="row"
                gap="size-75"
                justifyContent="start"
                alignItems="center"
              >
                <Icon svg={<Icons.EditOutline />} />
                <Text>Edit</Text>
              </Flex>
            </MenuItem>
            <MenuItem
              id={RetentionPolicyAction.DELETE}
              textValue="Delete Policy"
            >
              <Flex
                direction="row"
                gap="size-75"
                justifyContent="start"
                alignItems="center"
              >
                <Icon svg={<Icons.TrashOutline />} />
                <Text>Delete</Text>
              </Flex>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      {/* Edit Dialog */}
      <DialogTrigger isOpen={showEditDialog} onOpenChange={setShowEditDialog}>
        <ModalOverlay>
          <Modal size="M">
            <Dialog>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Retention Policy</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton
                      onPress={() => setShowEditDialog(false)}
                      slot="close"
                    />
                  </DialogTitleExtra>
                </DialogHeader>
                <Suspense fallback={<Loading />}>
                  <EditRetentionPolicy
                    policyId={policyId}
                    onEditCompleted={() => {
                      onPolicyEdit();
                      setShowEditDialog(false);
                    }}
                    onCancel={() => {
                      setShowEditDialog(false);
                    }}
                  />
                </Suspense>
              </DialogContent>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>

      {/* Delete Dialog */}
      <DialogTrigger
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <ModalOverlay>
          <Modal size="S">
            <Dialog>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Retention Policy</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton slot="close" />
                  </DialogTitleExtra>
                </DialogHeader>
                <View padding="size-200">
                  <Text color="danger">
                    {`Are you sure you want to delete retention policy "${policyName}"? This cannot be undone.`}
                  </Text>
                  <br />
                  {projectNames.length > 0 && (
                    <Text color="danger">
                      {`This policy is associated with the following projects: ${projectNames.join(
                        ", "
                      )}. These projects will fall back to the default policy.`}
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
                  <Flex direction="row" justifyContent="end" gap="size-100">
                    <Button
                      variant="default"
                      size="S"
                      slot="close"
                      isDisabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="S"
                      onPress={() => {
                        deletePolicy({
                          variables: {
                            policyId,
                            connectionId,
                          },
                        });
                        setShowDeleteDialog(false);
                        onPolicyDelete();
                      }}
                      isDisabled={isDeleting}
                      leadingVisual={
                        isDeleting ? (
                          <Icon svg={<Icons.LoadingOutline />} />
                        ) : undefined
                      }
                    >
                      {isDeleting ? "Deleting..." : "Delete Policy"}
                    </Button>
                  </Flex>
                </View>
              </DialogContent>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </StopPropagation>
  );
};
