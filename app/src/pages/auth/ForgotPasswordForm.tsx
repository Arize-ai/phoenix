import React, { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import { Alert, Button, Form, TextField, View } from "@arizeai/components";

type ForgotPasswordFormParams = {
  email: string;
};

export function ForgotPasswordForm({
  onResetSent,
}: {
  onResetSent: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const onSubmit = useCallback(
    async (params: ForgotPasswordFormParams) => {
      setError(null);
      setIsLoading(true);
      try {
        const response = await fetch("/auth/password-reset-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });
        if (!response.ok) {
          const message = await response.text();
          setError(message);
          return;
        }
        onResetSent();
      } finally {
        setIsLoading(() => false);
      }
    },
    [onResetSent, setError]
  );
  const { control, handleSubmit } = useForm<ForgotPasswordFormParams>({
    defaultValues: { email: "" },
  });
  return (
    <>
      {error ? (
        <View paddingBottom="size-100">
          <Alert variant="danger">{error}</Alert>
        </View>
      ) : null}
      <Form onSubmit={handleSubmit(onSubmit)}>
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
              description="Enter the email address associated with your account."
            />
          )}
        />
        <div
          css={css`
            margin-top: var(--ac-global-dimension-size-200);
            margin-bottom: var(--ac-global-dimension-size-50);
            button {
              width: 100%;
            }
          `}
        >
          <Button variant="primary" type={"submit"} loading={isLoading}>
            Send
          </Button>
        </div>
      </Form>
    </>
  );
}
