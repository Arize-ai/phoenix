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

export type LDAPUserFormParams = {
  email: string;
  username: string;
  role: UserRole;
};

/**
 * A form for creating a new LDAP user.
 * User details will be synced from LDAP on first login.
 *
 * @param {Object} props - The component props.
 * @param {Function} props.onSubmit - The function to call when the form is submitted.
 * @param {boolean} props.isSubmitting - Whether the form is submitting.
 */
export function LDAPUserForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (data: LDAPUserFormParams) => void;
  isSubmitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<LDAPUserFormParams>({
    defaultValues: {
      email: "",
      username: "",
      role: UserRole.MEMBER,
    },
  });

  const handleFormSubmit = (data: LDAPUserFormParams) => {
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
          <View paddingBottom="size-200">
            <Text color="text-700">
              Pre-create an LDAP user. User details (display name, role) will be
              synced from LDAP on first login.
            </Text>
          </View>
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
                      Must match the user&apos;s email in LDAP directory.
                    </Text>
                  )}
                </TextField>
              )}
            />
            <Controller
              name="username"
              control={control}
              rules={{
                required: "Display name is required",
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
                  <Label>Display Name</Label>
                  <Input />
                  {error ? (
                    <FieldError>{error?.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      Initial value; synced from LDAP on login.
                    </Text>
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
                <View>
                  <RoleSelect
                    onChange={onChange}
                    role={value}
                    errorMessage={error?.message}
                  />
                  <View paddingTop="size-50">
                    <Text slot="description" color="text-700">
                      Initial role; synced from LDAP group membership on login.
                    </Text>
                  </View>
                </View>
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
              {isSubmitting ? "Adding..." : "Add LDAP User"}
            </Button>
          </Flex>
        </View>
      </Form>
    </div>
  );
}
