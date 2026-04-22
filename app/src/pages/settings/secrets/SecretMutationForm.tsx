import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  Button,
  CredentialField,
  CredentialInput,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { SECRET_KEY_PATTERN } from "@phoenix/constants";

import type { SecretFormParams } from "./types";

function normalizeSecretKey(value: string) {
  return value.toUpperCase().replace(/\s+/g, "_");
}

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
  const keyInputRef = useRef<HTMLInputElement>(null);
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
              }) => {
                const handleChange = (value: string) => {
                  const input = keyInputRef.current;
                  const selectionStart = input?.selectionStart ?? value.length;

                  // Normalize live input to env-var style as the user types.
                  const transformed = normalizeSecretKey(value);

                  // Preserve the cursor after the transformed value is committed.
                  const beforeCursor = value.slice(0, selectionStart);
                  const newCursorPosition =
                    normalizeSecretKey(beforeCursor).length;

                  onChange(transformed);

                  // Wait for React to commit the transformed input value before
                  // restoring the cursor, or the selection update is lost.
                  requestAnimationFrame(() => {
                    input?.setSelectionRange(
                      newCursorPosition,
                      newCursorPosition
                    );
                  });
                };

                return (
                  <TextField
                    isInvalid={invalid}
                    onChange={handleChange}
                    onBlur={onBlur}
                    value={value}
                  >
                    <Label>Key</Label>
                    <Input
                      ref={keyInputRef}
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
                );
              }}
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
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <CredentialField
                isInvalid={!!error}
                onChange={onChange}
                value={value}
              >
                <Label>Value</Label>
                <CredentialInput placeholder="Enter a secret value" />
                {error?.message ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    This value is write-only and will not be shown again after
                    it is saved.
                  </Text>
                )}
              </CredentialField>
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
