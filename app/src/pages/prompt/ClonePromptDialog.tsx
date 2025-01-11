import React, { Suspense } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import { Dialog, TextArea } from "@arizeai/components";

import {
  Button,
  FieldError,
  Flex,
  Input,
  Label,
  Loading,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import { ClonePromptDialogMutation } from "@phoenix/pages/prompt/__generated__/ClonePromptDialogMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export const ClonePromptDialog = ({
  promptId,
  promptName,
  promptDescription,
  setDialog,
}: {
  promptId: string;
  promptName: string;
  promptDescription?: string;
  setDialog: (dialog: React.ReactNode | null) => void;
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
      name: `${promptName} (Clone)`,
      description: promptDescription,
    },
  });
  const {
    control,
    handleSubmit,
    formState: { isValid, errors },
    setError,
  } = form;
  const onSubmit = handleSubmit((data) => {
    clonePrompt({
      variables: {
        input: {
          promptId,
          name: data.name,
          description: data.description,
        },
      },
      onCompleted: (data) => {
        setDialog(null);
        notifySuccess({
          title: "Prompt cloned successfully",
          action: {
            text: "View Prompt",
            onClick: () => {
              navigate(`/prompts/${data.clonePrompt.id}`);
            },
          },
        });
      },
      onError: (error) => {
        const message = getErrorMessagesFromRelayMutationError(error);
        setError("root", {
          message: message?.[0] ?? "An error occurred",
        });
      },
    });
  });
  return (
    <Dialog title="Clone Prompt">
      <Suspense fallback={<Loading />}>
        <View padding="size-200">
          <form onSubmit={onSubmit}>
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
                <TextField isInvalid={!!error?.message}>
                  <Label>Description</Label>
                  <TextArea
                    name="description"
                    onChange={onChange}
                    onBlur={onBlur}
                    value={value}
                    height={100}
                    isDisabled={disabled}
                  />
                  {!error && (
                    <Text slot="description">
                      A description for the cloned prompt.
                    </Text>
                  )}
                  <FieldError>{error?.message}</FieldError>
                </TextField>
              )}
            />
            {errors?.root && (
              <Text color="danger">{errors?.root?.message}</Text>
            )}
            <Flex direction="row" justifyContent="end" gap="size-100">
              <Button
                variant="default"
                onPress={() => setDialog(null)}
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
    </Dialog>
  );
};
