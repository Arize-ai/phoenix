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

export const ClonePromptDialog = ({
  promptId,
  promptName,
  promptDescription,
}: {
  promptId: string;
  promptName: string;
  promptDescription?: string;
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
      clonePrompt({
        variables: {
          input: {
            promptId,
            name: data.name,
            description: data.description,
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
