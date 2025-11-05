import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useFragment, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Form,
  Icon,
  Icons,
  Label,
  Modal,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

import { EditPromptButton_data$key } from "./__generated__/EditPromptButton_data.graphql";
import { EditPromptButtonPatchPromptMutation } from "./__generated__/EditPromptButtonPatchPromptMutation.graphql";
type EditPromptFormParams = {
  description: string;
  metadata: string;
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
        metadata
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
  const { control, handleSubmit, reset } = useForm<EditPromptFormParams>({
    defaultValues: {
      description: data.description ?? "",
      metadata: data.metadata ? JSON.stringify(data.metadata, null, 2) : "{}",
    },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open) {
        reset({
          description: data.description ?? "",
          metadata: data.metadata
            ? JSON.stringify(data.metadata, null, 2)
            : "{}",
        });
      }
    },
    [data, reset]
  );
  const onSubmit = useCallback(
    (promptPatch: EditPromptFormParams) => {
      // Parse metadata, or set to null to clear if empty
      let metadata: unknown = null;
      if (promptPatch.metadata && promptPatch.metadata.trim() !== "") {
        try {
          metadata = JSON.parse(promptPatch.metadata);
        } catch (error) {
          notifyError({
            title: "Invalid metadata",
            message: "Failed to parse metadata as JSON",
          });
          return;
        }
      }

      mutatePrompt({
        variables: {
          input: {
            promptId: data.id,
            description: promptPatch.description,
            metadata,
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
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.SettingsOutline />} />}
        variant="quiet"
        aria-label="configure prompt"
      />
      <Modal size="M" isDismissable>
        <Dialog>
          <DialogHeader>
            <DialogTitle>Edit Prompt Details</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton />
            </DialogTitleExtra>
          </DialogHeader>
          <Form>
            <View padding="size-200">
              <Flex direction="column" gap="size-100">
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField value={field.value} onChange={field.onChange}>
                      <Label>Prompt Description</Label>
                      <TextArea placeholder="Enter a description for the prompt" />
                      <Text slot="description">
                        A description of the prompt
                      </Text>
                    </TextField>
                  )}
                />
                <Controller
                  name="metadata"
                  control={control}
                  rules={{
                    validate: (value) => {
                      // Allow empty values (will be treated as null)
                      if (!value || value.trim() === "") {
                        return true;
                      }
                      if (!isJSONObjectString(value)) {
                        return "metadata must be a valid JSON object";
                      }
                      return true;
                    },
                  }}
                  render={({
                    field: { onChange, onBlur, value },
                    fieldState: { error },
                  }) => (
                    <CodeEditorFieldWrapper
                      label={"Metadata"}
                      errorMessage={error?.message}
                      description="A JSON object containing metadata for the prompt"
                    >
                      <JSONEditor
                        value={value}
                        onChange={onChange}
                        onBlur={onBlur}
                      />
                    </CodeEditorFieldWrapper>
                  )}
                />
              </Flex>
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
