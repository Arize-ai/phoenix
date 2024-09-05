import React, { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Alert, Button, Form, TextField, View } from "@arizeai/components";

type LoginFormParams = {
  email: string;
  password: string;
};

export function LoginForm() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const onSubmit = useCallback(
    async (params: LoginFormParams) => {
      setError(null);
      setIsLoading(true);
      try {
        const response = await fetch("/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });
        if (!response.ok) {
          setError("Invalid login");
          return;
        }
      } catch (error) {
        setError("Invalid login");
        return;
      } finally {
        setIsLoading(() => false);
      }
      navigate("/");
    },
    [navigate, setError]
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
            loading={isLoading}
            onClick={handleSubmit(onSubmit)}
          >
            Login
          </Button>
        </div>
      </Form>
    </>
  );
}
