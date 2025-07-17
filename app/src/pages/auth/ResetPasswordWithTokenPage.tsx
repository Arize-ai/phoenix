import { useNavigate, useSearchParams } from "react-router";

import { Flex, Link, View } from "@phoenix/components";

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
      <View paddingTop="size-200">
        <Flex direction="column" alignItems="center" justifyContent="center">
          <Link to="/login">Back to Login</Link>
        </Flex>
      </View>
    </AuthLayout>
  );
}
