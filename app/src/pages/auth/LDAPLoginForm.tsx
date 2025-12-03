import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import {
  Alert,
  Button,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  TextField,
  View,
} from "@phoenix/components";
import { getReturnUrl, prependBasename } from "@phoenix/utils/routingUtils";

type LDAPLoginFormParams = {
  username: string;
  password: string;
};

type LDAPLoginFormProps = {
  initialError: string | null;
  /**
   * Callback function called when the form is submitted
   */
  onSubmit?: () => void;
};

export function LDAPLoginForm(props: LDAPLoginFormProps) {
  const navigate = useNavigate();
  const { initialError, onSubmit: propsOnSubmit } = props;
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const onSubmit = useCallback(
    async (params: LDAPLoginFormParams) => {
      propsOnSubmit?.();
      setError(null);
      setIsLoading(true);

      // Sanitize username by trimming whitespace
      const sanitizedParams = {
        ...params,
        username: params.username.trim(),
      };

      try {
        const response = await fetch(prependBasename("/auth/ldap/login"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sanitizedParams),
        });
        if (!response.ok) {
          const errorMessage =
            response.status === 429
              ? "Too many requests. Please try again later."
              : "Invalid login";
          setError(errorMessage);
          return;
        }
      } catch (_error) {
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
  const { control, handleSubmit } = useForm<LDAPLoginFormParams>({
    defaultValues: { username: "", password: "" },
  });
  return (
    <>
      {error ? (
        <View paddingBottom="size-100">
          <Alert variant="danger">{error}</Alert>{" "}
        </View>
      ) : null}
      <Form>
        <Flex direction="column" gap="size-100">
          <Controller
            name="username"
            control={control}
            render={({ field: { onChange, value, onBlur } }) => (
              <TextField
                name="username"
                isRequired
                type="text"
                onChange={onChange}
                onBlur={onBlur}
                value={value}
                autoComplete="username"
              >
                <Label>LDAP Username</Label>
                <Input placeholder="your LDAP username" />
              </TextField>
            )}
          />
          <Controller
            name="password"
            control={control}
            render={({ field: { onChange, value } }) => (
              <TextField
                name="password"
                type="password"
                isRequired
                onChange={onChange}
                value={value}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit(onSubmit)();
                  }
                }}
                autoComplete="current-password"
              >
                <Label>LDAP Password</Label>
                <Input placeholder="your password" />
              </TextField>
            )}
          />
          <Button
            variant="primary"
            isDisabled={isLoading}
            leadingVisual={
              isLoading ? <Icon svg={<Icons.LoadingOutline />} /> : undefined
            }
            onPress={() => handleSubmit(onSubmit)()}
          >
            {isLoading ? "Logging In" : "Log In"}
          </Button>
        </Flex>
      </Form>
    </>
  );
}
