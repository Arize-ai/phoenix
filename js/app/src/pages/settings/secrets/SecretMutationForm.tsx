import { Controller, useForm } from "react-hook-form";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  RedactedCredentialField,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { SECRET_KEY_PATTERN } from "@phoenix/constants";
import { TransformingInputController } from "@phoenix/hooks/useTransformingInput";
import { transformEnvironmentVariableInput } from "@phoenix/utils/environmentVariableUtils";

import type { SecretFormParams } from "./types";

export function SecretMutationForm({
  title,
  submitLabel,
  defaultKey = "",
  fixedKey,
  isSubmitting,
  onSubmit,
}: {
  title?: string;
  submitLabel: string;
  defaultKey?: string;
  fixedKey?: string;
  isSubmitting: boolean;
  onSubmit: (params: SecretFormParams) => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm<SecretFormParams>({
    defaultValues: {
      key: defaultKey,
      value: "",
    },
    mode: "onChange",
  });

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <View padding="size-200">
        {title ? (
          <View paddingBottom="size-100">
            <Text color="text-700">{title}</Text>
          </View>
        ) : null}
        <Flex direction="column" gap="size-200">
          {fixedKey ? (
            <View>
              <Text>{fixedKey}</Text>
            </View>
          ) : (
            <Controller
              name="key"
              control={control}
              rules={{
                required: "Secret key is required",
                validate: (value) => {
                  const trimmedValue = value.trim();
                  if (!SECRET_KEY_PATTERN.test(trimmedValue)) {
                    return "Use environment variable format: letters, numbers, and underscores only";
                  }
                  return true;
                },
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TransformingInputController
                  value={value}
                  onValueChange={onChange}
                  transformValue={transformEnvironmentVariableInput}
                >
                  {(transformingInput) => (
                    <TextField
                      isInvalid={invalid}
                      onChange={transformingInput.handleValueChange}
                      onBlur={onBlur}
                      value={transformingInput.displayValue}
                    >
                      <Label>Key</Label>
                      <Input
                        {...transformingInput.inputProps}
                        placeholder="e.g. OPENAI_API_KEY"
                      />
                      {error?.message ? (
                        <FieldError>{error.message}</FieldError>
                      ) : (
                        <Text slot="description">
                          Use the same format as an environment variable name.
                        </Text>
                      )}
                    </TextField>
                  )}
                </TransformingInputController>
              )}
            />
          )}
          <Controller
            name="value"
            control={control}
            rules={{
              required: "Secret value is required",
              validate: (value) => {
                if (!value.trim()) {
                  return "Secret value is required";
                }
                return true;
              },
            }}
            render={({
              field: { name, onChange, onBlur, value },
              fieldState: { error },
            }) => (
              <RedactedCredentialField
                label="Value"
                placeholder="Enter a secret value"
                description="This value is write-only and will not be shown again after it is saved."
                name={name}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                errorMessage={error?.message}
              />
            )}
          />
        </Flex>
      </View>
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderColor="default"
        borderTopWidth="thin"
      >
        <Flex direction="row" gap="size-100" justifyContent="end">
          <Button
            type="submit"
            size="S"
            variant={isDirty ? "primary" : "default"}
            isDisabled={!isValid || isSubmitting}
          >
            {submitLabel}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
