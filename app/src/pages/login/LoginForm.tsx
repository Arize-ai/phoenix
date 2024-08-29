import React, { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Alert, Button, Form, TextField, View } from "@arizeai/components";

import type { LoginFormMutation } from "./__generated__/LoginFormMutation.graphql";

type LoginFormParams = {
  email: string;
  password: string;
};

export function LoginForm() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [commit, isCommitting] = useMutation<LoginFormMutation>(graphql`
    mutation LoginFormMutation($email: String!, $password: String!) {
      login(input: { email: $email, password: $password })
    }
  `);
  const onSubmit = useCallback(
    (params: LoginFormParams) => {
      setError(null);
      commit({
        variables: params,
        onCompleted: () => {
          navigate("/");
        },
        onError: () => {
          setError("Invalid Login");
        },
      });
    },
    [commit, navigate]
  );
  const { control, handleSubmit } = useForm<LoginFormParams>({
    defaultValues: { email: "", password: "" },
  });
  return (
    <>
      {error ? (
        <View paddingBottom="size-100">
          <Alert variant="danger">{error}</Alert>{" "}
        </View>
      ) : null}
      <Form>
        <Controller
          name="email"
          control={control}
          render={({ field: { onChange, value } }) => (
            <TextField
              label="Email"
              name="email"
              isRequired
              type="email"
              onChange={onChange}
              value={value}
              placeholder="your email address"
            />
          )}
        />
        <Controller
          name="password"
          control={control}
          render={({ field: { onChange, value } }) => (
            <TextField
              label="Password"
              name="password"
              type="password"
              isRequired
              onChange={onChange}
              value={value}
              placeholder="your password"
            />
          )}
        />
        <div
          css={css`
            margin-top: var(--ac-global-dimension-size-400);
            margin-bottom: var(--ac-global-dimension-size-50);
            button {
              width: 100%;
            }
          `}
        >
          <Button
            variant="primary"
            loading={isCommitting}
            onClick={handleSubmit(onSubmit)}
          >
            Login
          </Button>
        </div>
      </Form>
    </>
  );
}
