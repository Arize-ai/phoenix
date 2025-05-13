import { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useFragment, useMutation } from "react-relay";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Form } from "@arizeai/components";

import {
  Button,
  FieldError,
  Input,
  Label,
  Text,
  TextField,
  VisuallyHidden,
} from "@phoenix/components";
import { useNotifyError } from "@phoenix/contexts";
import { createRedirectUrlWithReturn } from "@phoenix/utils/routingUtils";

import { ResetPasswordFormMutation } from "./__generated__/ResetPasswordFormMutation.graphql";
import { ResetPasswordFormQuery$key } from "./__generated__/ResetPasswordFormQuery.graphql";

const MIN_PASSWORD_LENGTH = 4;

export type ResetPasswordFormParams = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function ResetPasswordForm(props: {
  query: ResetPasswordFormQuery$key;
}) {
  const navigate = useNavigate();
  const notifyError = useNotifyError();
  const data = useFragment(
    graphql`
      fragment ResetPasswordFormQuery on Query {
        viewer {
          email
        }
      }
    `,
    props.query
  );
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
      <VisuallyHidden>
        <TextField
          name="email"
          type="email"
          autoComplete="email"
          isRequired
          isReadOnly
          value={data.viewer?.email}
        >
          <Label>Email</Label>
          <Input />
        </TextField>
      </VisuallyHidden>
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
            type="password"
            name={name}
            isRequired
            isInvalid={invalid}
            onChange={onChange}
            onBlur={onBlur}
            value={value}
            id="current-password"
            autoComplete="current-password"
          >
            <Label>Old Password</Label>
            <Input />
            {error ? (
              <FieldError>{error?.message}</FieldError>
            ) : (
              <Text slot="description">The current password</Text>
            )}
          </TextField>
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
            type="password"
            isRequired
            name={name}
            isInvalid={invalid}
            onChange={onChange}
            onBlur={onBlur}
            defaultValue={value}
            id="new-password"
            autoComplete="new-password"
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
            isRequired
            type="password"
            name={name}
            isInvalid={invalid}
            onChange={onChange}
            onBlur={onBlur}
            defaultValue={value}
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
      <div
        css={css`
          display: flex;
          flex-direction: row;
          gap: var(--ac-global-dimension-size-200);
          padding-top: var(--ac-global-dimension-size-100);
          & > * {
            width: 50%;
          }
        `}
      >
        <Button
          onPress={() => {
            navigate(-1);
          }}
        >
          Cancel
        </Button>
        <Button variant="primary" type="submit" isDisabled={isCommitting}>
          {isCommitting ? "Resetting..." : "Reset Password"}
        </Button>
      </div>
    </Form>
  );
}
