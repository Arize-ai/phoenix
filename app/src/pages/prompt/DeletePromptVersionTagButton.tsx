import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Modal,
  Text,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";

import { DeletePromptVersionTagButtonMutation } from "./__generated__/DeletePromptVersionTagButtonMutation.graphql";

export function DeletePromptVersionTagButton({
  promptVersionTagId,
  promptId,
}: {
  promptVersionTagId: string;
  promptId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const [commitDelete, isCommitting] =
    useMutation<DeletePromptVersionTagButtonMutation>(graphql`
      mutation DeletePromptVersionTagButtonMutation(
        $input: DeletePromptVersionTagInput!
        $promptId: ID!
      ) {
        deletePromptVersionTag(input: $input) {
          query {
            node(id: $promptId) {
              ...PromptVersionTagsConfigCard_data
            }
          }
        }
      }
    `);
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        aria-label="Delete tag"
        size="S"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
      />
      <Modal size="S" isDismissable>
        <Dialog>
          <Heading slot="title">Delete Tag</Heading>
          <View padding="size-200">
            <View paddingBottom="size-100">
              <Text color="danger" size="XS">
                Are you sure you want to delete this tag? This will make pulling
                prompts by this tag no longer possible. Make sure this tag is
                not used before deleting.
              </Text>
            </View>
          </View>
          <View
            paddingX="size-200"
            paddingY="size-100"
            borderTopWidth="thin"
            borderColor="light"
          >
            <Flex gap="size-100" justifyContent="end">
              <Button size="S" onPress={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="S"
                onPress={() =>
                  commitDelete({
                    variables: {
                      input: {
                        promptVersionTagId,
                      },
                      promptId,
                    },
                    onCompleted: () => {
                      notifySuccess({
                        title: "Tag Deleted",
                        message: "The tag has been deleted",
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
    </DialogTrigger>
  );
}
