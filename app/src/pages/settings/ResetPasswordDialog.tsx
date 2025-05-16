import { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import { Dialog } from "@arizeai/components";

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
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { ResetPasswordDialogMutation } from "./__generated__/ResetPasswordDialogMutation.graphql";

const MIN_PASSWORD_LENGTH = 4;

export type ResetPasswordFormParams = {
  newPassword: string;
  confirmPassword: string;
};

export function ResetPasswordDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();
  const [commit, isCommitting] = useMutation<ResetPasswordDialogMutation>(
    graphql`
      mutation ResetPasswordDialogMutation($input: PatchUserInput!) {
        patchUser(input: $input) {
          __typename
        }
      }
    `
  );
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<ResetPasswordFormParams>({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = useCallback(
    (data: ResetPasswordFormParams) => {
      commit({
        variables: {
          input: {
            userId,
            newPassword: data.newPassword,
          },
        },
        onCompleted: () => {
          notifySuccess({
            title: "Password reset",
            message: "Users password has been reset.",
          });
          onClose();
        },
        onError: (error) => {
          notifyError({
            title: "Failed to reset password",
            message: error.message,
          });
        },
      });
    },
    [commit, notifyError, notifySuccess, onClose, userId]
  );
  return (
    <Dialog title="Reset Password" isDismissable onDismiss={onClose}>
      <Form>
        <View padding="size-200">
          <Flex direction="column" gap="size-100">
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
                  isInvalid={invalid}
                  onChange={onChange}
                  name={name}
                  onBlur={onBlur}
                  value={value.toString()}
                  type="password"
                  id="new-password"
                  autoComplete="new-password"
                >
                  <Label>New Password</Label>
                  <Input placeholder="New password" />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
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
                  isInvalid={invalid}
                  onChange={onChange}
                  name={name}
                  onBlur={onBlur}
                  value={value.toString()}
                  type="password"
                >
                  <Label>Confirm Password</Label>
                  <Input placeholder="Repeat new password" />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      Repeat new password to confirm
                    </Text>
                  )}
                </TextField>
              )}
            />
          </Flex>
          <View paddingTop="size-200">
            <Flex direction="row" gap="size-100" justifyContent="end">
              <Button
                variant={isDirty ? "primary" : "default"}
                type="submit"
                isDisabled={isCommitting}
                onPress={() => handleSubmit(onSubmit)()}
              >
                {isCommitting ? "Resetting..." : "Reset Password"}
              </Button>
            </Flex>
          </View>
        </View>
      </Form>
    </Dialog>
  );
}
