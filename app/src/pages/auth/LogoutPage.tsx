import React from "react";
import { useSearchParams } from "react-router";
import { css } from "@emotion/react";

import { Alert, Flex, View } from "@phoenix/components";

import { AuthLayout } from "./AuthLayout";
import { OAuth2Login } from "./OAuth2Login";
import { PhoenixLogo } from "./PhoenixLogo";

const separatorCSS = css`
  text-align: center;
  margin-top: var(--ac-global-dimension-size-200);
  margin-bottom: var(--ac-global-dimension-size-200);
  color: var(--ac-global-text-color-700);
`;

const oAuthLoginButtonListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
  flex-wrap: wrap;
  justify-content: center;
`;

export function LogoutPage() {
  const oAuth2Idps = window.Config.oAuth2Idps;
  const hasOAuth2Idps = oAuth2Idps.length > 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const message = "You have been logged out";
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      {message && (
        <View paddingBottom="size-100">
          <Alert variant="success">{message}</Alert>
        </View>
      )}
      {hasOAuth2Idps && (
        <>
          <ul css={oAuthLoginButtonListCSS}>
            {oAuth2Idps.slice(0,1).map((idp) => (
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
        </>
      )}
    </AuthLayout>
  );
}
