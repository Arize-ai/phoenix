import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Form,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { prependBasename } from "@phoenix/utils/routingUtils";

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
        const response = await fetch(
          prependBasename("/auth/password-reset-email"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
          }
        );
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
              name="email"
              isRequired
              type="email"
              onChange={onChange}
              value={value}
            >
              <Label>Email</Label>
              <Input placeholder="your email address" />
              <Text slot="description">
                Enter the email address associated with your account.
              </Text>
            </TextField>
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
          <Button variant="primary" type={"submit"} isDisabled={isLoading}>
            {isLoading ? "Sending..." : "Send"}
          </Button>
        </div>
      </Form>
    </>
  );
}
