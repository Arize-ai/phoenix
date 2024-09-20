import React, { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Alert, Button, Form, TextField, View } from "@arizeai/components";

import { Link } from "@phoenix/components";
import { getReturnUrl } from "@phoenix/utils/routingUtils";

type LoginFormParams = {
  email: string;
  password: string;
};

type LoginFormProps = {
  initialError: string | null;
  /**
   * Callback function called when the form is submitted
   */
  onSubmit?: () => void;
};
export function LoginForm(props: LoginFormProps) {
  const navigate = useNavigate();
  const { initialError, onSubmit: propsOnSubmit } = props;
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const onSubmit = useCallback(
    async (params: LoginFormParams) => {
      propsOnSubmit?.();
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
          const errorMessage =
            response.status === 429
              ? "Too many requests. Please try again later."
              : "Invalid login";
          setError(errorMessage);
          return;
        }
      } catch (error) {
        setError("Invalid login");
        return;
      } finally {
        setIsLoading(() => false);
      }
      const returnUrl = getReturnUrl();
      navigate(returnUrl);
    },
    [navigate, propsOnSubmit, setError]
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
        <div
          css={css`
            position: relative;
            a {
              position: absolute;
              float: right;
              right: 0;
              top: var(--ac-global-dimension-size-50);
              font-size: 12px;
            }
          `}
        >
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit(onSubmit)();
                  }
                }}
              />
            )}
          />
          <Link to="/forgot-password">Forgot your password?</Link>
        </div>
        <div
          css={css`
            margin-top: var(--ac-global-dimension-size-200);
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
