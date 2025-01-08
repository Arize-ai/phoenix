import React from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
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
  const notifySuccess = useNotifySuccess();
  const [commitDelete, isCommitting] =
    useMutation<DeletePromptVersionTagButtonMutation>(graphql`
      mutation DeletePromptVersionTagButtonMutation(
        $input: DeletePromptVersionTagInput!
        $promptId: GlobalID!
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
    <DialogTrigger>
      <Button
        aria-label="Delete tag"
        size="S"
        icon={<Icon svg={<Icons.TrashOutline />} />}
      />
      <Popover placement="bottom end">
        <PopoverArrow />
        <Dialog>
          <View padding="size-200">
            <View paddingBottom="size-100">
              <Text color="danger" size="XS">
                Are you sure you want to delete this tag? This will make pulling
                prompts by this tag no longer possible. Make sure this tag is
                not used before deleting.
              </Text>
            </View>
            <Button
              width="100%"
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
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
