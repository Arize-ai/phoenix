import React from "react";
import { css } from "@emotion/react";

import { Button, Flex, Form, View } from "@arizeai/components";

import { AuthLayout } from "./AuthLayout";
import { LoginForm } from "./LoginForm";
import { PhoenixLogo } from "./PhoenixLogo";

export function LoginPage() {
  const oAuth2Idps = window.Config.oAuth2Idps;
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <LoginForm />
      {oAuth2Idps.map((idp) => (
        <OAuth2LoginForm
          key={idp.name}
          idpName={idp.name}
          idpDisplayName={idp.displayName}
        />
      ))}
    </AuthLayout>
  );
}

type OAuth2LoginFormProps = {
  idpName: string;
  idpDisplayName: string;
};
export function OAuth2LoginForm({
  idpName,
  idpDisplayName,
}: OAuth2LoginFormProps) {
  return (
    <Form action={`/oauth2/${idpName}/login`} method="post">
      <div
        css={css`
          margin-top: var(--ac-global-dimension-size-400);
          margin-bottom: var(--ac-global-dimension-size-50);
          button {
            width: 100%;
          }
        `}
      >
        <Button variant="primary" type="submit">
          Login with {idpDisplayName}
        </Button>
      </div>
    </Form>
  );
}
