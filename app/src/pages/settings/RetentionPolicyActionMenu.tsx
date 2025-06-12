import { Suspense, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import { ActionMenu, Item } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Modal,
  ModalOverlay,
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
  /**
   * The ID of the connection to the policy.
   */
  connectionId: string;
}

export const RetentionPolicyActionMenu = ({
  policyId,
  policyName,
  projectNames,
  onPolicyEdit,
  onPolicyDelete,
  connectionId,
}: RetentionPolicyActionMenuProps) => {
  const canDelete = policyName !== DEFAULT_POLICY_NAME;
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      <ActionMenu
        buttonSize="compact"
        disabledKeys={canDelete ? [] : [RetentionPolicyAction.DELETE]}
        align="end"
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

      {/* Edit Dialog */}
      <DialogTrigger isOpen={showEditDialog} onOpenChange={setShowEditDialog}>
        <></>
        <ModalOverlay isDismissable>
          <Modal
            variant="default"
            css={css`
              width: 600px;
              max-width: 90vw;
            `}
          >
            <Dialog>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Retention Policy</DialogTitle>
                  <DialogTitleExtra>
                    <Button
                      size="S"
                      data-testid="dialog-close-button"
                      leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
                      onPress={() => setShowEditDialog(false)}
                      type="button"
                      variant="default"
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
        <></>
        <ModalOverlay isDismissable>
          <Modal
            variant="default"
            css={css`
              width: 500px;
              max-width: 90vw;
            `}
          >
            <Dialog>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Retention Policy</DialogTitle>
                  <DialogTitleExtra>
                    <Button
                      size="S"
                      data-testid="dialog-close-button"
                      leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
                      onPress={() => setShowDeleteDialog(false)}
                      type="button"
                      variant="default"
                      slot="close"
                    />
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
                      onPress={() => setShowDeleteDialog(false)}
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
