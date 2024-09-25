import React, { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Button, Form, TextField, View } from "@arizeai/components";

import { useNotifyError } from "@phoenix/contexts";
import { createRedirectUrlWithReturn } from "@phoenix/utils/routingUtils";

import { ResetPasswordFormMutation } from "./__generated__/ResetPasswordFormMutation.graphql";

const MIN_PASSWORD_LENGTH = 4;

export type ResetPasswordFormParams = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function ResetPasswordForm() {
  const navigate = useNavigate();
  const notifyError = useNotifyError();
  const [commit, isCommitting] = useMutation<ResetPasswordFormMutation>(graphql`
    mutation ResetPasswordFormMutation($input: PatchViewerInput!) {
      patchViewer(input: $input) {
        __typename
      }
    }
  `);
  const { control, handleSubmit } = useForm<ResetPasswordFormParams>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = useCallback(
    (data: ResetPasswordFormParams) => {
      commit({
        variables: {
          input: {
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
          },
        },
        onCompleted: () => {
          const to = createRedirectUrlWithReturn({
            path: "/login",
            searchParams: { message: "Password has been reset." },
          });
          navigate(to);
        },
        onError: (error) => {
          notifyError({
            title: "Failed to reset password",
            message: error.message,
          });
        },
      });
    },
    [commit, navigate, notifyError]
  );
  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="currentPassword"
        control={control}
        rules={{
          required: "the current is required",
        }}
        render={({
          field: { name, onChange, onBlur, value },
          fieldState: { invalid, error },
        }) => (
          <TextField
            label="Old Password"
            type="password"
            name={name}
            isRequired
            description="The current password"
            errorMessage={error?.message}
            validationState={invalid ? "invalid" : "valid"}
            onChange={onChange}
            onBlur={onBlur}
            value={value}
          />
        )}
      />
      <Controller
        name="newPassword"
        control={control}
        rules={{
          required: "Password is required",
          minLength: {
            value: MIN_PASSWORD_LENGTH,
            message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          },
          validate: (value, formValues) =>
            value !== formValues.currentPassword ||
            "New password must be different",
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
        <div
          css={css`
            display: flex;
            flex-direction: row;
            gap: var(--ac-global-dimension-size-200);
            & > * {
              width: 50%;
            }
          `}
        >
          <Button
            variant="default"
            onClick={() => {
              navigate(-1);
            }}
          >
            Cancel
          </Button>
          <Button variant={"primary"} type="submit" disabled={isCommitting}>
            {isCommitting ? "Resetting..." : "Reset Password"}
          </Button>
        </div>
      </View>
    </Form>
  );
}
