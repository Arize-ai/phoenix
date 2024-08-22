import React from "react";
import { css } from "@emotion/react";

import { Flex, View } from "@arizeai/components";

import { Logo } from "@phoenix/components/nav/Logo";

import { LoginForm } from "./LoginForm";

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
