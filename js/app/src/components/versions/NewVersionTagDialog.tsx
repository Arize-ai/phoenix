import { useState } from "react";
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
import { IDENTIFIER_DESCRIPTION } from "@phoenix/constants";
import { TransformingInputController } from "@phoenix/hooks/useTransformingInput";
import {
  transformIdentifierInput,
  trimIdentifierSeparators,
  validateIdentifier,
} from "@phoenix/utils/identifierUtils";

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
  const [isNameFocused, setIsNameFocused] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isDirty, isSubmitted },
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
                    fieldState: { error, isTouched },
                  }) => {
                    const displayedError =
                      (isTouched && !isNameFocused) || isSubmitted
                        ? error
                        : undefined;
                    return (
                      <TransformingInputController
                        value={value}
                        onValueChange={onChange}
                        transformValue={transformIdentifierInput}
                        finalizeValue={trimIdentifierSeparators}
                      >
                        {(transformingInput) => (
                          <TextField
                            isInvalid={!!displayedError}
                            onChange={transformingInput.handleValueChange}
                            onFocus={() => setIsNameFocused(true)}
                            onBlur={() => {
                              setIsNameFocused(false);
                              transformingInput.handleBlur();
                              onBlur();
                            }}
                            name={name}
                            value={transformingInput.displayValue}
                          >
                            <Label>Tag Name</Label>
                            <Input
                              {...transformingInput.inputProps}
                              placeholder="e.x. prod"
                            />
                            {displayedError?.message ? (
                              <FieldError>{displayedError.message}</FieldError>
                            ) : (
                              <Text slot="description">
                                {IDENTIFIER_DESCRIPTION}
                              </Text>
                            )}
                          </TextField>
                        )}
                      </TransformingInputController>
                    );
                  }}
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
