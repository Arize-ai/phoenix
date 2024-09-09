import React from "react";
import { css } from "@emotion/react";

import { Flex, View } from "@arizeai/components";
import { Button } from "@arizeai/components";

import { AuthLayout } from "./AuthLayout";
import { LoginForm } from "./LoginForm";
import { PhoenixLogo } from "./PhoenixLogo";

export function LoginPage() {
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <LoginForm />
      <OAuthLoginButton />
    </AuthLayout>
  );
}

function OAuthLoginButton() {
  return (
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
        onClick={() => {
          const oAuthClientId = window.Config.oAuthClientId;
          if (oAuthClientId === null) {
            // todo: display error message
            return;
          }
          const origin = new URL(window.location.href).origin;
          const callbackUrl = `${origin}/oauth-callback`;
          const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
          url.searchParams.append("response_type", "code");
          url.searchParams.append("client_id", oAuthClientId);
          url.searchParams.append("redirect_uri", callbackUrl);
          url.searchParams.append("scope", "profile email");
          const state = window.crypto.randomUUID();
          sessionStorage.setItem("oAuthState", state);
          url.searchParams.append("state", state);
          window.location.href = url.toString();
        }}
        variant={"primary"}
      >
        Login with OAuth
      </Button>
    </div>
  );
}
