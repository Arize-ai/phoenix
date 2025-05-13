import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useFragment, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Form,
  Heading,
  Icon,
  Icons,
  Label,
  Modal,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { EditPromptButton_data$key } from "./__generated__/EditPromptButton_data.graphql";
import { EditPromptButtonPatchPromptMutation } from "./__generated__/EditPromptButtonPatchPromptMutation.graphql";
type EditPromptFormParams = {
  description: string;
};

export function EditPromptButton(props: { prompt: EditPromptButton_data$key }) {
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const data = useFragment(
    graphql`
      fragment EditPromptButton_data on Prompt {
        id
        description
      }
    `,
    props.prompt
  );
  const [mutatePrompt, isMutating] =
    useMutation<EditPromptButtonPatchPromptMutation>(graphql`
      mutation EditPromptButtonPatchPromptMutation($input: PatchPromptInput!) {
        patchPrompt(input: $input) {
          ...PromptIndexPage__main
        }
      }
    `);
  const { control, handleSubmit } = useForm<EditPromptFormParams>({
    defaultValues: {
      description: data.description ?? "",
    },
  });
  const onSubmit = useCallback(
    (promptPatch: EditPromptFormParams) => {
      mutatePrompt({
        variables: {
          input: {
            promptId: data.id,
            description: promptPatch.description,
          },
        },
        onCompleted: () => {
          setIsOpen(false);
          notifySuccess({
            title: "Prompt updated",
            message: "The prompt has been updated successfully",
          });
        },
        onError: (error) => {
          notifyError({
            title: "Error updating prompt",
            message: getErrorMessagesFromRelayMutationError(error)?.[0],
          });
        },
      });
    },
    [data.id, mutatePrompt, notifyError, notifySuccess]
  );
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.SettingsOutline />} />}
        variant="quiet"
        aria-label="configure prompt"
        onPress={() => setIsOpen(true)}
      />
      <Modal size="S" isDismissable>
        <Dialog>
          <Heading slot="title">Edit Prompt Details</Heading>
          <Form>
            <View padding="size-200">
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField value={field.value} onChange={field.onChange}>
                    <Label>Prompt Description</Label>
                    <TextArea placeholder="Enter a description for the prompt" />
                    <Text slot="description">A description of the prompt</Text>
                  </TextField>
                )}
              />
            </View>
            <View
              paddingX="size-200"
              paddingY="size-100"
              borderTopColor="light"
              borderTopWidth="thin"
            >
              <Flex direction="row" gap="size-100" justifyContent="end">
                <Button slot="close" size="S">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="S"
                  isDisabled={isMutating}
                  onPress={() => handleSubmit(onSubmit)()}
                >
                  {isMutating ? "Saving..." : "Save"}
                </Button>
              </Flex>
            </View>
          </Form>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}
