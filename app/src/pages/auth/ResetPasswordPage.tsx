import { useLoaderData } from "react-router";

import { Flex, View } from "@phoenix/components";

import { AuthLayout } from "./AuthLayout";
import { PhoenixLogo } from "./PhoenixLogo";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { resetPasswordLoader } from "./resetPasswordLoader";

export function ResetPasswordPage() {
  const loaderData = useLoaderData<typeof resetPasswordLoader>();
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <ResetPasswordForm query={loaderData} />
    </AuthLayout>
  );
}
