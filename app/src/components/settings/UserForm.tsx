import React from "react";
import { Controller, useForm } from "react-hook-form";

import {
  Button,
  Field,
  Flex,
  Form,
  TextField,
  View,
} from "@arizeai/components";

import { UserRole } from "@phoenix/constants";

import { RolePicker } from "./RolePicker";

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
    formState: { isDirty, isValid },
  } = useForm<UserFormParams>({
    defaultValues: {
      email: email ?? "",
      username: username ?? null,
      password: password ?? "",
      role: role ?? UserRole.ADMIN,
    },
  });
  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <View padding="size-200">
        <Controller
          name="email"
          control={control}
          rules={{
            required: "Email is required",
          }}
          render={({
            field: { name, onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              label="Email"
              name={name}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              onChange={onChange}
              onBlur={onBlur}
              value={value.toString()}
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
              label="username"
              name={name}
              isRequired={false}
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
          }}
          render={({
            field: { name, onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              label="password"
              type="password"
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
            <Field
              validationState={invalid ? "invalid" : "valid"}
              errorMessage={error?.message}
            >
              <RolePicker onChange={onChange} role={value} />
            </Field>
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
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create User"}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
