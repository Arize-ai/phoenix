import { Suspense } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import {
  Button,
  Dialog,
  FieldError,
  Flex,
  Input,
  Label,
  Loading,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import { ClonePromptDialogMutation } from "@phoenix/pages/prompt/__generated__/ClonePromptDialogMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

export const ClonePromptDialog = ({
  promptId,
  promptName,
  promptDescription,
  promptMetadata,
}: {
  promptId: string;
  promptName: string;
  promptDescription?: string;
  promptMetadata?: Record<string, unknown>;
}) => {
  const notifySuccess = useNotifySuccess();
  const navigate = useNavigate();
  const [clonePrompt, isClonePending] = useMutation<ClonePromptDialogMutation>(
    graphql`
      mutation ClonePromptDialogMutation($input: ClonePromptInput!) {
        clonePrompt(input: $input) {
          id
        }
      }
    `
  );
  const form = useForm({
    disabled: isClonePending,
    reValidateMode: "onBlur",
    mode: "onChange",
    defaultValues: {
      name: `${promptName}-clone`,
      description: promptDescription,
      metadata: promptMetadata ? JSON.stringify(promptMetadata, null, 2) : "{}",
    },
  });
  const {
    control,
    handleSubmit,
    formState: { isValid, errors },
    setError,
  } = form;
  const onSubmit = (close: () => void) =>
    handleSubmit((data) => {
      // Parse metadata, or set to null to clear if empty
      let metadata: unknown = null;
      if (data.metadata && data.metadata.trim() !== "") {
        try {
          metadata = JSON.parse(data.metadata);
        } catch (error) {
          setError("metadata", {
            message: "Failed to parse metadata as JSON",
          });
          return;
        }
      }
      clonePrompt({
        variables: {
          input: {
            promptId,
            name: data.name,
            description: data.description,
            metadata,
          },
        },
        onCompleted: (data) => {
          notifySuccess({
            title: "Prompt cloned successfully",
            action: {
              text: "View Prompt",
              onClick: () => {
                navigate(`/prompts/${data.clonePrompt.id}`);
              },
            },
          });
          close();
        },
        onError: (error) => {
          const message = getErrorMessagesFromRelayMutationError(error);
          if (message?.[0]?.includes("already exists")) {
            setError("name", {
              message: message?.[0],
            });
          } else {
            setError("root", {
              message: message?.[0],
            });
          }
        },
      });
    });
  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Prompt</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton slot="close" />
            </DialogTitleExtra>
          </DialogHeader>
          <Suspense fallback={<Loading />}>
            <View padding="size-200">
              <form onSubmit={onSubmit(close)}>
                <Flex direction="column" gap="size-100">
                  <Controller
                    control={control}
                    name="name"
                    rules={{
                      required: { message: "Name is required", value: true },
                      validate: {
                        unique: (value) => {
                          if (value.trim() === promptName.trim()) {
                            return "Name must be different from the original prompt name";
                          }
                          return true;
                        },
                      },
                    }}
                    render={({
                      field: { onChange, onBlur, value, disabled },
                      fieldState: { error },
                    }) => (
                      <TextField isInvalid={!!error?.message}>
                        <Label>Name</Label>
                        <Input
                          name="name"
                          type="text"
                          onChange={onChange}
                          onBlur={onBlur}
                          value={value}
                          disabled={disabled}
                        />
                        {!error && (
                          <Text slot="description">
                            A name for the cloned prompt.
                          </Text>
                        )}
                        <FieldError>{error?.message}</FieldError>
                      </TextField>
                    )}
                  />
                  <Controller
                    control={control}
                    name="description"
                    render={({
                      field: { onChange, onBlur, value, disabled },
                      fieldState: { error },
                    }) => (
                      <TextField
                        isInvalid={!!error?.message}
                        isDisabled={disabled}
                        value={value}
                        onChange={onChange}
                        onBlur={onBlur}
                      >
                        <Label>Description</Label>
                        <TextArea name="description" />
                        {!error && (
                          <Text slot="description">
                            A description for the cloned prompt.
                          </Text>
                        )}
                        <FieldError>{error?.message}</FieldError>
                      </TextField>
                    )}
                  />
                  <Controller
                    control={control}
                    name="metadata"
                    rules={{
                      validate: (value) => {
                        // Allow empty values (will be treated as undefined)
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
                      fieldState: { invalid, error },
                    }) => (
                      <CodeEditorFieldWrapper
                        validationState={invalid ? "invalid" : "valid"}
                        label="Metadata"
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
                {errors?.root && (
                  <Text color="danger">{errors?.root?.message}</Text>
                )}
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button
                    slot="close"
                    variant="default"
                    isDisabled={isClonePending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isDisabled={!isValid}
                    isPending={isClonePending}
                  >
                    Clone
                  </Button>
                </Flex>
              </form>
            </View>
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
};
