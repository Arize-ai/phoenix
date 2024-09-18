import React, { useState } from "react";

import { Flex, View } from "@arizeai/components";

import { Link } from "@phoenix/components";

import { AuthLayout } from "./AuthLayout";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { PhoenixLogo } from "./PhoenixLogo";

export function ForgotPasswordPage() {
  const [resetSent, setResetSent] = useState<boolean>(false);
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <Flex
        direction="column"
        justifyContent="stretch"
        alignItems="center"
        gap="size-200"
      >
        <ForgotPasswordForm />
        <Link to="/login">Back to Login</Link>
      </Flex>
    </AuthLayout>
  );
}
