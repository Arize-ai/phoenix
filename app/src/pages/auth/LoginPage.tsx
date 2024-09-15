import React from "react";
import { css } from "@emotion/react";

import { Button, Flex, Form, View } from "@arizeai/components";

import { AuthLayout } from "./AuthLayout";
import { LoginForm } from "./LoginForm";
import { PhoenixLogo } from "./PhoenixLogo";

export function LoginPage() {
  const oAuthIdps = window.Config.oAuthIdps;
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <LoginForm />
      {oAuthIdps.map((idp) => (
        <OAuthLoginForm
          key={idp.id}
          idpId={idp.id}
          idpDisplayName={idp.displayName}
        />
      ))}
    </AuthLayout>
  );
}

type OAuthLoginFormProps = {
  idpId: string;
  idpDisplayName: string;
};
export function OAuthLoginForm({ idpId, idpDisplayName }: OAuthLoginFormProps) {
  return (
    <Form key={idpId} action={`/oauth/${idpId}/login`} method="post">
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
