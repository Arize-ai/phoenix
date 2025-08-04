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

import { RoleSelect } from "./RoleSelect";

export type OAuthUserFormParams = {
  email: string;
  username: string;
  role: UserRole;
};

/**
 * A form for creating a new user with OAuth.
 *
 * @param {Object} props - The component props.
 * @param {Function} props.onSubmit - The function to call when the form is submitted.
 * @param {string} props.email - The email of the user.
 * @param {string} props.username - The username of the user.
 * @param {UserRole} props.role - The role of the user.
 * @param {boolean} props.isSubmitting - Whether the form is submitting.
 */
export function OAuthUserForm({
  onSubmit,
  email,
  username,
  role,
  isSubmitting,
}: {
  onSubmit: (data: OAuthUserFormParams) => void;
  isSubmitting: boolean;
} & Partial<OAuthUserFormParams>) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<OAuthUserFormParams>({
    defaultValues: {
      email: email ?? "",
      username: username ?? "",
      role: role ?? UserRole.MEMBER,
    },
  });

  const handleFormSubmit = (data: OAuthUserFormParams) => {
    // Sanitize email by trimming whitespace and converting to lowercase
    const sanitizedData = {
      ...data,
      email: data.email.trim().toLowerCase(),
    };
    onSubmit(sanitizedData);
  };

  return (
    <div
      css={css`
        .role-select {
          width: 100%;
          .ac-dropdown--picker,
          .ac-dropdown-button {
            width: 100%;
          }
        }
      `}
    >
      <Form onSubmit={handleSubmit(handleFormSubmit)}>
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
                fieldState: { error, invalid },
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
                required: "Username is required",
              }}
              render={({
                field: { name, onChange, onBlur, value },
                fieldState: { error, invalid },
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
              name="role"
              control={control}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <RoleSelect
                  onChange={onChange}
                  role={value}
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
