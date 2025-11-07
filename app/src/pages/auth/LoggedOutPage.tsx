import { useSearchParams } from "react-router";
import { css } from "@emotion/react";

import { Alert, Flex, LinkButton, View } from "@phoenix/components";

import { getAuthErrorMessage } from "./authErrors";
import { AuthLayout } from "./AuthLayout";
import { OAuth2Login } from "./OAuth2Login";
import { PhoenixLogo } from "./PhoenixLogo";

const oAuthLoginButtonListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
  flex-wrap: wrap;
  justify-content: center;
`;

export function LoggedOutPage() {
  const oAuth2Idps = window.Config.oAuth2Idps;
  const hasOAuth2Idps = oAuth2Idps.length > 0;
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const showBacktoLogin = !window.Config.basicAuthDisabled;
  const errorCode = searchParams.get("error");
  // Validate and get safe error message (prevents XSS/phishing via query params)
  const errorMessage = getAuthErrorMessage(errorCode);
  return (
    <AuthLayout>
      <title>Logged Out - Phoenix</title>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <View paddingBottom="size-100">
        <Alert variant={errorMessage ? "danger" : "success"}>
          {errorMessage || "You have been logged out"}
        </Alert>
      </View>
      {showBacktoLogin && (
        <View paddingY="size-100">
          <LinkButton to="/login">Back to login</LinkButton>
        </View>
      )}
      {hasOAuth2Idps && (
        <ul css={oAuthLoginButtonListCSS}>
          {oAuth2Idps.slice(0, 1).map((idp) => (
            <li key={idp.name}>
              <OAuth2Login
                key={idp.name}
                idpName={idp.name}
                idpDisplayName={idp.displayName}
                returnUrl={returnUrl}
              />
            </li>
          ))}
        </ul>
      )}
    </AuthLayout>
  );
}
