import React from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Dialog,
  DialogContainer,
  Form,
  TextArea,
} from "@arizeai/components";

import {
  Button,
  FieldError,
  Flex,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";

type PromptVersionTagFormParams = {
  name: string;
  description: string;
};

export function NewPromptVersionDialog({
  onNewTagCreated,
  promptVersionId,
  onDismiss,
}: {
  /**
   * The prompt version to set the tag on
   */
  promptVersionId: string;
  onNewTagCreated: (tag: PromptVersionTagFormParams) => void;
  onDismiss: () => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<PromptVersionTagFormParams>({
    defaultValues: {
      name: "",
      description: "",
    },
  });
  const [error, setError] = React.useState<string | null>(null);
  const [commitCreate, isCommitting] = useMutation(graphql`
    mutation NewPromptVersionTagDialogMutation(
      $input: SetPromptVersionTagInput!
      $promptVersionId: GlobalID!
    ) {
      setPromptVersionTag(input: $input) {
        query {
          node(id: $promptVersionId) {
            ...PromptVersionTagsList_data
          }
        }
      }
    }
  `);
  const onSubmit = (newTag: PromptVersionTagFormParams) => {
    setError(null);
    commitCreate({
      variables: {
        input: {
          name: newTag.name,
          description: newTag.description,
          promptVersionId: promptVersionId,
        },
        promptVersionId,
      },
      onCompleted: () => {
        onNewTagCreated(newTag);
        onDismiss();
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  };

  return (
    <DialogContainer onDismiss={onDismiss} isDismissable type="modal">
      <Dialog title="New Prompt Tag">
        {error ? (
          <Alert variant="danger" banner>
            {error}
          </Alert>
        ) : null}
        <Form onSubmit={handleSubmit(onSubmit)}>
          <View padding="size-200">
            <Controller
              name="name"
              control={control}
              rules={{
                required: "Name is required",
                pattern: {
                  value: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
                  message:
                    "Invalid identifier. Must be alphanumeric and with dashes",
                },
              }}
              render={({
                field: { name, onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TextField
                  isInvalid={invalid}
                  onChange={onChange}
                  onBlur={onBlur}
                  name={name}
                  value={value.toString()}
                >
                  <Label>Tag Name</Label>
                  <Input placeholder="e.x. prod" />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">The identifier of the tag</Text>
                  )}
                </TextField>
              )}
            />
            <Controller
              name="description"
              control={control}
              render={({
                field: { name, onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TextArea
                  label="description"
                  description={`A description of the tag (optional)`}
                  isRequired={false}
                  name={name}
                  height={100}
                  errorMessage={error?.message}
                  validationState={invalid ? "invalid" : "valid"}
                  onChange={onChange}
                  onBlur={onBlur}
                  value={value?.toString()}
                />
              )}
            />
          </View>
          <View
            paddingX="size-200"
            paddingY="size-100"
            borderTopColor="dark"
            borderTopWidth="thin"
          >
            <Flex gap="size-100" justifyContent="end">
              <Button
                variant={isDirty ? "primary" : "default"}
                size="S"
                type="submit"
                isDisabled={isCommitting}
              >
                Create Tag
              </Button>
            </Flex>
          </View>
        </Form>
      </Dialog>
    </DialogContainer>
  );
}