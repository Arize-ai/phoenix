import React from "react";
import { useNavigate } from "react-router";
import { useSearchParams } from "react-router-dom";

import { Flex, View } from "@arizeai/components";

import { AuthLayout } from "./AuthLayout";
import { PhoenixLogo } from "./PhoenixLogo";
import { ResetPasswordWithTokenForm } from "./ResetPasswordWithTokenForm";

export function ResetPasswordWithTokenPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  if (!token) {
    navigate("/login");
    return null;
  }
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <ResetPasswordWithTokenForm resetToken={token} />
    </AuthLayout>
  );
}
