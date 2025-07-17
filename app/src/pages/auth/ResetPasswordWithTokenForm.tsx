import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Form } from "@arizeai/components";

import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { prependBasename } from "@phoenix/utils/routingUtils";

const MIN_PASSWORD_LENGTH = 4;

export type ResetPasswordWithTokenFormParams = {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
};

interface ResetPasswordWithTokenFormProps {
  resetToken: string;
}

const DEFAULT_ERROR_MESSAGE = "An error occurred. Please try resetting again.";

export function ResetPasswordWithTokenForm({
  resetToken,
}: ResetPasswordWithTokenFormProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const onSubmit = useCallback(
    async ({ resetToken, newPassword }: ResetPasswordWithTokenFormParams) => {
      setError(null);
      setIsLoading(true);
      try {
        const response = await fetch(prependBasename("/auth/password-reset"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: resetToken, password: newPassword }),
        });
        if (!response.ok) {
          const text = await response.text();
          setError(text);
          return;
        }
      } catch (error) {
        setError(DEFAULT_ERROR_MESSAGE);
        return;
      } finally {
        setIsLoading(() => false);
      }
      navigate(
        `/login?message=${encodeURIComponent("Password has been reset.")}`
      );
    },
    [setError, navigate]
  );
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<ResetPasswordWithTokenFormParams>({
    defaultValues: {
      resetToken: resetToken,
      newPassword: "",
      confirmPassword: "",
    },
  });
  return (
    <>
      {error ? (
        <View paddingBottom="size-100">
          <Alert variant="danger">{error}</Alert>
        </View>
      ) : null}
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="newPassword"
          control={control}
          rules={{
            required: "Password is required",
            minLength: {
              value: MIN_PASSWORD_LENGTH,
              message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
            },
          }}
          render={({
            field: { name, onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              type="password"
              isRequired
              name={name}
              isInvalid={invalid}
              id="new-password"
              autoComplete="new-password"
              onChange={onChange}
              onBlur={onBlur}
              defaultValue={value}
            >
              <Label>New Password</Label>

              <Input />
              {error ? (
                <FieldError>{error?.message}</FieldError>
              ) : (
                <Text slot="description">
                  Password must be at least {MIN_PASSWORD_LENGTH} characters
                </Text>
              )}
            </TextField>
          )}
        />
        <Controller
          name="confirmPassword"
          control={control}
          rules={{
            required: "Password is required",
            minLength: {
              value: MIN_PASSWORD_LENGTH,
              message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
            },
            validate: (value, formValues) =>
              value === formValues.newPassword || "Passwords do not match",
          }}
          render={({
            field: { name, onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              type="password"
              isRequired
              name={name}
              isInvalid={invalid}
              onChange={onChange}
              onBlur={onBlur}
              defaultValue={value}
            >
              <Label>Confirm Password</Label>
              <Input />
              {error ? (
                <FieldError>{error?.message}</FieldError>
              ) : (
                <Text slot="description">Confirm the new password</Text>
              )}
            </TextField>
          )}
        />
        <div
          css={css`
            margin-top: var(--ac-global-dimension-size-200);
            margin-bottom: var(--ac-global-dimension-size-50);
            button {
              width: 100%;
            }
          `}
        >
          <Button
            variant={isDirty ? "primary" : "default"}
            type="submit"
            isDisabled={isLoading}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </div>
      </Form>
    </>
  );
}
