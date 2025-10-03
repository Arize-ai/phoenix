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

import { DeleteDatasetLabelButtonMutation } from "./__generated__/DeleteDatasetLabelButtonMutation.graphql";

export type DeleteDatasetLabelButtonProps = {
  datasetLabelId: string;
};

export function DeleteDatasetLabelButton(props: DeleteDatasetLabelButtonProps) {
  const { datasetLabelId } = props;
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [deleteLabel, isDeleting] =
    useMutation<DeleteDatasetLabelButtonMutation>(graphql`
      mutation DeleteDatasetLabelButtonMutation(
        $input: DeleteDatasetLabelsInput!
        $connections: [ID!]!
      ) {
        deleteDatasetLabels(input: $input) {
          datasetLabels {
            id @deleteEdge(connections: $connections)
          }
        }
      }
    `);
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        aria-label="Delete Dataset Label"
        isDisabled={isDeleting}
      />
      <ModalOverlay>
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Dataset Label</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <DialogContent>
                <View padding="size-200">
                  <Text color="danger">
                    Are you sure you want to delete this label? It will be
                    removed from all datasets if you do so.
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
                              input: { datasetLabelIds: [datasetLabelId] },
                              connections: [
                                ConnectionHandler.getConnectionID(
                                  "client:root",
                                  "DatasetLabelsTable__datasetLabels"
                                ),
                              ],
                            },
                            onCompleted: () => {
                              notifySuccess({
                                title: "Label Deleted",
                                message: "Successfully deleted dataset label",
                              });
                              setIsOpen(false);
                            },
                            onError: () => {
                              notifyError({
                                title: "Failed to delete label",
                                message:
                                  "Failed to delete dataset label. Please try again.",
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
