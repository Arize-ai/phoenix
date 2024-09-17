import React from "react";
import { css } from "@emotion/react";

import { Flex, View } from "@arizeai/components";

import { AuthLayout } from "./AuthLayout";
import { LoginForm } from "./LoginForm";
import { OAuth2Login } from "./Oauth2Login";
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

export function LoginPage() {
  const oAuth2Idps = window.Config.oAuth2Idps;
  const hasOAuth2Idps = oAuth2Idps.length > 0;
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      <LoginForm />
      {hasOAuth2Idps && (
        <>
          <div css={separatorCSS}>or</div>
          <ul css={oAuthLoginButtonListCSS}>
            {oAuth2Idps.map((idp) => (
              <li key={idp.name}>
                <OAuth2Login
                  key={idp.name}
                  idpName={idp.name}
                  idpDisplayName={idp.displayName}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </AuthLayout>
  );
}
