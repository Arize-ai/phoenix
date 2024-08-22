import React, { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import { Button, Flex, Form, TextField, View } from "@arizeai/components";

import { Logo } from "@phoenix/components/nav/Logo";

import type { LoginPageMutation } from "./__generated__/LoginPageMutation.graphql";

export function LoginPage() {
  return (
    <main
      css={css`
        padding-top: var(--ac-global-dimension-size-2000);
        width: 100%;
      `}
    >
      <View
        borderColor="dark"
        borderWidth="thin"
        width="size-5000"
        padding="size-400"
        backgroundColor="dark"
        marginStart="auto"
        marginEnd="auto"
        borderRadius="medium"
      >
        <Flex direction="column" gap="size-200" alignItems="center">
          <View paddingBottom="size-400">
            <Logo size={120} />
          </View>
        </Flex>
        <LoginForm />
      </View>
    </main>
  );
}

type LoginFormParams = {
  email: string;
  password: string;
};

export function LoginForm() {
  const [commit, isCommiting] = useMutation<LoginPageMutation>(graphql`
    mutation LoginPageMutation($email: String!, $password: String!) {
      login(input: { email: $email, password: $password }) {
        success
      }
    }
  `);
  const onSubmit = useCallback(
    (params: LoginFormParams) => {
      commit({
        variables: params,
        onCompleted: (response) => {
          if (response.login.success) {
            return;
          } else {
            return;
          }
        },
      });
    },
    [commit]
  );
  const { control, handleSubmit } = useForm<LoginFormParams>({
    defaultValues: { email: "", password: "" },
  });
  return (
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
          loading={isCommiting}
          onClick={handleSubmit(onSubmit)}
        >
          Login
        </Button>
      </div>
    </Form>
  );
}
