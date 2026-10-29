import { Controller, useForm } from "react-hook-form";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

export type VersionTagFormParams = {
  name: string;
  description: string;
};

/**
 * The form that names a new version tag and sets it on a version. The
 * caller runs the mutation and reports its error.
 */
export function NewVersionTagDialog({
  title,
  onSubmit,
  onDismiss,
  error,
  isCommitting,
}: {
  title: string;
  onSubmit: (tag: VersionTagFormParams) => void;
  onDismiss: () => void;
  error: string | null;
  isCommitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<VersionTagFormParams>({
    defaultValues: {
      name: "",
      description: "",
    },
    mode: "onChange",
  });
  return (
    <ViewportModalOverlay>
      <ViewportModal size="M">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton onPress={onDismiss} slot="close" />
              </DialogTitleExtra>
            </DialogHeader>
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
                    validate: validateIdentifier,
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
                      value={value}
                    >
                      <Label>Tag Name</Label>
                      <Input placeholder="e.x. prod" />
                      {error?.message ? (
                        <FieldError>{error.message}</FieldError>
                      ) : (
                        <Text slot="description">
                          The identifier of the tag
                        </Text>
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
                      value={value}
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
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex gap="size-100" justifyContent="end">
                  <Button
                    variant="default"
                    size="S"
                    onPress={onDismiss}
                    isDisabled={isCommitting}
                  >
                    Cancel
                  </Button>
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
          </DialogContent>
        </Dialog>
      </ViewportModal>
    </ViewportModalOverlay>
  );
}
