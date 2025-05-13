import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import { Dialog, DialogContainer } from "@arizeai/components";

import {
  Alert,
  Button,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";

import { identifierPattern } from "../../utils/identifierUtils";

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
  const [error, setError] = useState<string | null>(null);
  const [commitCreate, isCommitting] = useMutation(graphql`
    mutation NewPromptVersionTagDialogMutation(
      $input: SetPromptVersionTagInput!
      $promptVersionId: ID!
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
                pattern: identifierPattern,
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
                <TextField
                  isInvalid={invalid}
                  onChange={onChange}
                  name={name}
                  onBlur={onBlur}
                  value={value.toString()}
                >
                  <Label>Description</Label>
                  <TextArea placeholder="A description of the tag" />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      A description of the tag (optional)
                    </Text>
                  )}
                </TextField>
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
