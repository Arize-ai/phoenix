import React from "react";
import { css } from "@emotion/react";

import { Button, Flex, Form, TextField, View } from "@arizeai/components";

import { PhoenixLogo } from "./PhoenixLogo";

export function LoginPage() {
  return (
    <main
      css={css`
        padding-top: 200px;
        width: 100%;
        height: 100vh;
        background: radial-gradient(
          90% 60% at 50% 30%,
          rgba(5, 145, 193, 0.4) 0%,
          transparent 100%
        );
      `}
    >
      <View
        borderColor="light"
        borderWidth="thin"
        width="size-5000"
        padding="size-400"
        backgroundColor="dark"
        marginStart="auto"
        marginEnd="auto"
        borderRadius="medium"
      >
        <Flex direction="column" gap="size-200" alignItems="center">
          <View paddingBottom="size-200">
            <PhoenixLogo />
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
