import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  useNotifyError,
  useNotifySuccess,
} from "@phoenix/contexts/NotificationContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { DeleteDecisionVersionTagButtonMutation } from "./__generated__/DeleteDecisionVersionTagButtonMutation.graphql";

export function DeleteDecisionVersionTagButton({
  decisionVersionTagId,
  tagName,
}: {
  decisionVersionTagId: string;
  tagName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [commitDelete, isCommitting] =
    useMutation<DeleteDecisionVersionTagButtonMutation>(graphql`
      mutation DeleteDecisionVersionTagButtonMutation(
        $decisionVersionTagId: ID!
      ) {
        deleteDecisionVersionTag(
          input: { decisionVersionTagId: $decisionVersionTagId }
        ) {
          decision {
            versionTags {
              id
              name
            }
            ...DecisionVersionTagsConfigCard_data
            ...DecisionVersionsList__main
            ...DecisionLatestVersionsListFragment
          }
        }
      }
    `);
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        aria-label={`Delete tag ${tagName}`}
        size="S"
        leadingVisual={<Icon svg={<Icons.Trash />} />}
      />
      <ModalOverlay>
        <Modal size="S">
          <Dialog>
            <DialogHeader>
              <DialogTitle>Delete Tag</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <View paddingBottom="size-100">
                <Text color="danger" size="XS">
                  Are you sure you want to delete the tag {tagName}?
                  Applications following it will no longer be able to resolve
                  it. The version will remain available by ID.
                </Text>
              </View>
            </View>
            <View
              paddingX="size-200"
              paddingY="size-100"
              borderTopWidth="thin"
              borderColor="default"
            >
              <Flex gap="size-100" justifyContent="end">
                <Button size="S" onPress={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="S"
                  isDisabled={isCommitting}
                  onPress={() =>
                    commitDelete({
                      variables: { decisionVersionTagId },
                      onCompleted: () => {
                        setIsOpen(false);
                        notifySuccess({
                          title: "Tag Deleted",
                          message: `The tag ${tagName} has been deleted`,
                        });
                      },
                      onError: (error) => {
                        setIsOpen(false);
                        notifyError({
                          title: "Failed to delete tag",
                          message:
                            getErrorMessagesFromRelayMutationError(
                              error
                            )?.[0] ?? error.message,
                        });
                      },
                    })
                  }
                >
                  {isCommitting ? "Deleting..." : "Delete Tag"}
                </Button>
              </Flex>
            </View>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
