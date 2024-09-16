import React, { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  Alert,
  Button,
  Flex,
  Form,
  TextField,
  View,
} from "@arizeai/components";

const MIN_PASSWORD_LENGTH = 4;

export type ResetPasswordWithTokenFormParams = {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
};

interface ResetPasswordWithTokenFormProps {
  resetToken: string;
}

export function ResetPasswordWithTokenForm({
  resetToken,
}: ResetPasswordWithTokenFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const onSubmit = useCallback(
    async ({ resetToken, newPassword }: ResetPasswordWithTokenFormParams) => {
      setMessage(null);
      setError(null);
      setIsLoading(true);
      try {
        const response = await fetch("/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: resetToken, password: newPassword }),
        });
        if (!response.ok) {
          setError("Failed attempt");
          return;
        }
      } catch (error) {
        setError("Failed attempt");
        return;
      } finally {
        setIsLoading(() => false);
      }
      setMessage("Success");
    },
    [setMessage, setError]
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
      {message ? (
        <View paddingBottom="size-100">
          <Alert variant="success">{message}</Alert>{" "}
        </View>
      ) : null}
      {error ? (
        <View paddingBottom="size-100">
          <Alert variant="danger">{error}</Alert>{" "}
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
              label="New Password"
              type="password"
              isRequired
              description={`Password must be at least ${MIN_PASSWORD_LENGTH} characters`}
              name={name}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              onChange={onChange}
              onBlur={onBlur}
              defaultValue={value}
            />
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
              label="Confirm Password"
              isRequired
              type="password"
              description="Confirm the new password"
              name={name}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              onChange={onChange}
              onBlur={onBlur}
              defaultValue={value}
            />
          )}
        />
        <View paddingTop="size-200">
          <Flex direction="row" gap="size-100" justifyContent="end">
            <Button
              variant={isDirty ? "primary" : "default"}
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </Flex>
        </View>
      </Form>
    </>
  );
}
