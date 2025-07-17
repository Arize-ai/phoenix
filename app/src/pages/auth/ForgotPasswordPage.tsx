import { useState } from "react";
import { css } from "@emotion/react";

import { Flex, Heading, Link } from "@phoenix/components";

import { AuthLayout } from "./AuthLayout";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export function ForgotPasswordPage() {
  const [resetSent, setResetSent] = useState<boolean>(false);
  const content = resetSent ? (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      gap="size-100"
    >
      <Heading level={1}>Check your email</Heading>
      <p>
        {`Thanks! If an account with that email address exists, we sent you a link to reset your password.`}
      </p>
    </Flex>
  ) : (
    <>
      <Flex
        direction="column"
        alignItems="center"
        justifyContent="center"
        gap="size-100"
      >
        <Heading level={1}>Forgot Password</Heading>
        <p>
          {`Enter the email address associated with your account and we'll send you
        a link to reset your password.`}
        </p>
      </Flex>
      <ForgotPasswordForm onResetSent={() => setResetSent(true)} />
    </>
  );
  return (
    <AuthLayout>
      <div
        css={css`
          & a {
            text-align: center;
            width: 100%;
            display: block;
            text-align: center;
            padding-top: var(--ac-global-dimension-size-200);
          }
        `}
      >
        {content}
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          gap="size-200"
        >
          <Link to="/login">Back to Login</Link>
        </Flex>
      </div>
    </AuthLayout>
  );
}
