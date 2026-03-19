import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";

import { Flex, View } from "@phoenix/components";

import type { resetPasswordLoaderQuery as ResetPasswordLoaderQuery } from "./__generated__/resetPasswordLoaderQuery.graphql";
import { AuthLayout } from "./AuthLayout";
import { PhoenixLogo } from "./PhoenixLogo";
import { ResetPasswordForm } from "./ResetPasswordForm";
import type { ResetPasswordLoaderData } from "./resetPasswordLoader";
import { resetPasswordLoaderQuery } from "./resetPasswordLoader";

export function ResetPasswordPage() {
  const loaderData = useLoaderData<ResetPasswordLoaderData>();
  const data = usePreloadedQuery<ResetPasswordLoaderQuery>(
    resetPasswordLoaderQuery,
    loaderData.queryRef
  );
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
