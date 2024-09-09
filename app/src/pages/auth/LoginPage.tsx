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
      <GitHubLoginButton />
    </AuthLayout>
  );
}

function GitHubLoginButton() {
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
          const githubClientId = window.Config.githubClientId;
          if (githubClientId === null) {
            // todo: display error message
            return;
          }
          const origin = new URL(window.location.href).origin;
          const callbackUrl = encodeURIComponent(
            `${origin}/github-oauth-callback`
          );
          // todo: add state parameter
          window.location.href = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${callbackUrl}`;
        }}
        variant={"primary"}
      >
        Log in with GitHub
      </Button>
    </div>
  );
}
