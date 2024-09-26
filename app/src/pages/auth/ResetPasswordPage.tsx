import React from "react";

import { Flex, View } from "@arizeai/components";

import { AuthLayout } from "./AuthLayout";
import { PhoenixLogo } from "./PhoenixLogo";
import { ResetPasswordForm } from "./ResetPasswordForm";

export function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
