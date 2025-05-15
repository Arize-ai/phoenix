import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { UserRole } from "@phoenix/constants";

import { RolePicker } from "./RolePicker";

const MIN_PASSWORD_LENGTH = 4;

export type UserFormParams = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
};

export function UserForm({
  onSubmit,
  email,
  username,
  password,
  role,
  isSubmitting,
}: {
  onSubmit: (data: UserFormParams) => void;
  isSubmitting: boolean;
} & Partial<UserFormParams>) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<UserFormParams>({
    defaultValues: {
      email: email ?? "",
      username: username ?? "",
      password: password ?? "",
      confirmPassword: "",
      role: role ?? UserRole.MEMBER,
    },
  });
  return (
    <div
      css={css`
        .role-picker {
          width: 100%;
          .ac-dropdown--picker,
          .ac-dropdown-button {
            width: 100%;
          }
        }
      `}
    >
      <Form onSubmit={handleSubmit(onSubmit)}>
        <View padding="size-200">
          <Flex direction="column" gap="size-100">
            <Controller
              name="email"
              control={control}
              rules={{
                required: "Email is required",
                pattern: {
                  value: /^[^@\s]+@[^@\s]+[.][^@\s]+$/,
                  message: "Invalid email format",
                },
              }}
              render={({
                field: { name, onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TextField
                  type="email"
                  name={name}
                  isRequired
                  onChange={onChange}
                  isInvalid={invalid}
                  onBlur={onBlur}
                  value={value}
                >
                  <Label>Email</Label>
                  <Input />
                  {error ? (
                    <FieldError>{error?.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      The user&apos;s email address. Must be unique.
                    </Text>
                  )}
                </TextField>
              )}
            />
            <Controller
              name="username"
              control={control}
              rules={{
                required: "Email is required",
              }}
              render={({
                field: { name, onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TextField
                  name={name}
                  isRequired
                  onChange={onChange}
                  isInvalid={invalid}
                  onBlur={onBlur}
                  value={value}
                >
                  <Label>Username</Label>
                  <Input />
                  {error ? (
                    <FieldError>{error?.message}</FieldError>
                  ) : (
                    <Text slot="description">A unique username.</Text>
                  )}
                </TextField>
              )}
            />
            <Controller
              name="password"
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
                  onChange={onChange}
                  onBlur={onBlur}
                  defaultValue={value}
                  autoComplete="new-password"
                >
                  <Label>Password</Label>
                  <Input />
                  {error ? (
                    <FieldError>{error?.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      Password must be at least 4 characters
                    </Text>
                  )}
                </TextField>
              )}
            />
            <Controller
              name="confirmPassword"
              control={control}
              rules={{
                required: "Please confirm your password",
                minLength: {
                  value: MIN_PASSWORD_LENGTH,
                  message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
                },
                validate: (value, formValues) =>
                  value === formValues.password || "Passwords do not match",
              }}
              render={({
                field: { name, onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TextField
                  isRequired
                  type="password"
                  name={name}
                  isInvalid={invalid}
                  onChange={onChange}
                  onBlur={onBlur}
                  defaultValue={value ?? undefined}
                  autoComplete="new-password"
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
            <Controller
              name="role"
              control={control}
              render={({
                field: { onChange, value },
                fieldState: { invalid, error },
              }) => (
                <RolePicker
                  onChange={onChange}
                  role={value}
                  validationState={invalid ? "invalid" : "valid"}
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
          borderColor="dark"
          borderTopWidth="thin"
        >
          <Flex direction="row" gap="size-100" justifyContent="end">
            <Button
              variant={isDirty ? "primary" : "default"}
              type="submit"
              size="S"
              isDisabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add User"}
            </Button>
          </Flex>
        </View>
      </Form>
    </div>
  );
}
