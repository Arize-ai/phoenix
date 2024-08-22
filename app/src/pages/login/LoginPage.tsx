import React from "react";
import { css } from "@emotion/react";

import { Button, Flex, Form, TextField, View } from "@arizeai/components";

import { Logo } from "@phoenix/components/nav/Logo";

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
        <Form action="/login" method="post">
          <TextField
            label="Email"
            name="email"
            isRequired
            type="email"
            placeholder="your email address"
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            isRequired
            placeholder="your password"
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
            <Button variant="primary" type="submit">
              Login
            </Button>
          </div>
        </Form>
      </View>
    </main>
  );
}
