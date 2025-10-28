import { useState } from "react";
import { ModalOverlay } from "react-aria-components";
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
  Modal,
  Text,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { DeletePromptLabelButtonMutation } from "./__generated__/DeletePromptLabelButtonMutation.graphql";

export type DeletePromptLabelButtonProps = {
  promptLabelId: string;
};

export function DeletePromptLabelButton(props: DeletePromptLabelButtonProps) {
  const { promptLabelId } = props;
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [deleteLabel, isDeleting] =
    useMutation<DeletePromptLabelButtonMutation>(graphql`
      mutation DeletePromptLabelButtonMutation(
        $input: DeletePromptLabelsInput!
        $connections: [ID!]!
      ) {
        deletePromptLabels(input: $input) {
          deletedPromptLabelIds @deleteEdge(connections: $connections)
        }
      }
    `);
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        aria-label="Delete Prompt Label"
        isDisabled={isDeleting}
      />
      <ModalOverlay>
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Prompt Label</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <DialogContent>
                <View padding="size-200">
                  <Text color="danger">
                    Are you sure you want to delete this label? It will be
                    removed from all prompts if you do so.
                  </Text>
                  <View paddingTop="size-100">
                    <Flex direction="row" justifyContent="end">
                      <Button
                        variant="danger"
                        size="S"
                        isDisabled={isDeleting}
                        onPress={() => {
                          deleteLabel({
                            variables: {
                              input: { promptLabelIds: [promptLabelId] },
                              connections: [
                                ConnectionHandler.getConnectionID(
                                  "client:root",
                                  "PromptLabelConfigButtonAllLabels_promptLabels"
                                ),
                                ConnectionHandler.getConnectionID(
                                  "client:root",
                                  "PromptLabelsTable__promptLabels"
                                ),
                              ],
                            },
                            onCompleted: () => {
                              notifySuccess({
                                title: "Label Deleted",
                                message: "Successfully deleted prompt label",
                              });
                              setIsOpen(false);
                            },
                            onError: () => {
                              notifyError({
                                title: "Failed to delete prompt label",
                                message: "Please try again",
                              });
                            },
                          });
                        }}
                      >
                        Delete
                      </Button>
                    </Flex>
                  </View>
                </View>
              </DialogContent>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
