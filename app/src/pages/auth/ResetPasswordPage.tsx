import React from "react";
import { useSearchParams } from "react-router-dom";

import { Flex, View } from "@arizeai/components";

import { AuthLayout } from "./AuthLayout";
import { PhoenixLogo } from "./PhoenixLogo";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { ResetPasswordWithTokenForm } from "./ResetPasswordWithTokenForm";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      {token ? (
        <ResetPasswordWithTokenForm resetToken={token} />
      ) : (
        <ResetPasswordForm />
      )}
    </AuthLayout>
  );
}
