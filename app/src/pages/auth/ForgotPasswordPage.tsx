import React from "react";

import { Flex, View } from "@arizeai/components";

import { AuthLayout } from "./AuthLayout";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { PhoenixLogo } from "./PhoenixLogo";

export function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
