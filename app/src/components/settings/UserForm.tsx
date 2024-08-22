import React from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import { Button, Flex, Form, TextField, View } from "@arizeai/components";

import { UserRole } from "@phoenix/constants";

import { RolePicker } from "./RolePicker";

const MIN_PASSWORD_LENGTH = 4;

export type UserFormParams = {
  email: string;
  username: string | null;
  password: string;
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
      username: username ?? null,
      password: password ?? "",
      role: role ?? UserRole.ADMIN,
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
                label="Email"
                type="email"
                name={name}
                isRequired
                description="The user's email address. Must be unique."
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                value={value}
              />
            )}
          />
          <Controller
            name="username"
            control={control}
            render={({
              field: { name, onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextField
                label="Username"
                name={name}
                description="The user's username. Optional."
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                value={value?.toString()}
              />
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
                label="Password"
                type="password"
                description="Password must be at least 4 characters"
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
              size="compact"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add User"}
            </Button>
          </Flex>
        </View>
      </Form>
    </div>
  );
}
