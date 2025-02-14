import React from "react";
import { useLoaderData } from "react-router";

import { Flex, View } from "@phoenix/components";

import { resetPasswordLoaderQuery$data } from "./__generated__/resetPasswordLoaderQuery.graphql";
import { AuthLayout } from "./AuthLayout";
import { PhoenixLogo } from "./PhoenixLogo";
import { ResetPasswordForm } from "./ResetPasswordForm";

export function ResetPasswordPage() {
  const data = useLoaderData() as resetPasswordLoaderQuery$data;
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <ResetPasswordForm query={data} />
    </AuthLayout>
  );
}
