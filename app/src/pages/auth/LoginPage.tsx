import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { css } from "@emotion/react";

import { Alert, Flex, View } from "@phoenix/components";

import { AuthLayout } from "./AuthLayout";
import { LoginForm } from "./LoginForm";
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

export function LoginPage() {
  const oAuth2Idps = window.Config.oAuth2Idps;
  const hasOAuth2Idps = oAuth2Idps.length > 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const message = searchParams.get("message");
  // The name of the idp to trigger
  const triggerIdp = searchParams.get("trigger");

  // Refs for each idp form
  const formRefs = useRef<Record<string, HTMLFormElement | null>>({});

  useEffect(() => {
    if (triggerIdp && hasOAuth2Idps) {
      const idp = oAuth2Idps.find(
        (idp) => idp.name.toLowerCase() === triggerIdp.toLowerCase()
      );
      if (idp && formRefs.current[idp.name]) {
        formRefs.current[idp.name]?.submit();
      }
    }
    // Only run on mount or when triggerIdp changes
  }, [triggerIdp, hasOAuth2Idps, oAuth2Idps]);

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
      <LoginForm
        initialError={searchParams.get("error")}
        onSubmit={() => {
          setSearchParams((prevSearchParams) => {
            // Clear message and error
            const newSearchParams = new URLSearchParams(prevSearchParams);
            newSearchParams.delete("message");
            newSearchParams.delete("error");
            return newSearchParams;
          });
        }}
      />
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
                  returnUrl={returnUrl}
                  ref={(el: HTMLFormElement | null) => {
                    formRefs.current[idp.name] = el;
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </AuthLayout>
  );
}
