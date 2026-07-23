import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useSearchParams } from "react-router";

import { Alert, Flex, LinkButton, View } from "@phoenix/components";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { OAuth2ConsentPageQuery } from "./__generated__/OAuth2ConsentPageQuery.graphql";
import { AuthLayout } from "./AuthLayout";
import { OAuth2ConsentCard } from "./OAuth2ConsentCard";
import { PhoenixLogo } from "./PhoenixLogo";

type AuthorizationDecisionResponse = {
  redirect_to?: string;
};

function getRequiredParam(searchParams: URLSearchParams, name: string) {
  const value = searchParams.get(name);
  return value && value.trim() ? value : null;
}

export function OAuth2ConsentPage() {
  const { authenticationEnabled } = useFunctionality();
  return (
    <AuthLayout>
      {authenticationEnabled ? <OAuth2Consent /> : <AuthenticationDisabled />}
    </AuthLayout>
  );
}

/**
 * Shown when an OAuth2 authorization URL is opened against a server running
 * without authentication — there is no user to authorize on behalf of.
 */
function AuthenticationDisabled() {
  return (
    <Flex direction="column" gap="size-200" alignItems="center">
      <View paddingBottom="size-200">
        <PhoenixLogo />
      </View>
      <Alert variant="warning" title="Authentication is not enabled">
        This Phoenix server is running without authentication, so it cannot
        authorize applications. Enable authentication on the server to sign in
        from other applications.
      </Alert>
      <View paddingY="size-100">
        <LinkButton to="/">Return home</LinkButton>
      </View>
    </Flex>
  );
}

function OAuth2Consent() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const data = useLazyLoadQuery<OAuth2ConsentPageQuery>(
    graphql`
      query OAuth2ConsentPageQuery {
        viewer {
          email
          username
        }
      }
    `,
    {}
  );

  const clientId = getRequiredParam(searchParams, "client_id");
  const redirectUri = getRequiredParam(searchParams, "redirect_uri");
  const state = getRequiredParam(searchParams, "state");
  const codeChallenge = getRequiredParam(searchParams, "code_challenge");
  const codeChallengeMethod = getRequiredParam(
    searchParams,
    "code_challenge_method"
  );
  const responseType = getRequiredParam(searchParams, "response_type");
  const clientName =
    searchParams.get("client_name") || clientId || "OAuth2 client";
  const isFirstParty = searchParams.get("is_first_party") === "true";
  const hasRequiredParams =
    clientId != null &&
    redirectUri != null &&
    state != null &&
    codeChallenge != null &&
    codeChallengeMethod != null &&
    responseType != null;
  const signedInAs =
    data.viewer?.email || data.viewer?.username || "the current user";

  const submitDecision = async (approved: boolean) => {
    if (!hasRequiredParams) {
      setError("The authorization request is missing required parameters.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(
        prependBasename("/oauth2/authorize/decision"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: clientId,
            redirect_uri: redirectUri,
            state,
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
            response_type: responseType,
            resource: searchParams.get("resource"),
            scope: searchParams.get("scope"),
            approved,
          }),
        }
      );
      const payload: AuthorizationDecisionResponse = await response.json();
      if (!response.ok || !payload.redirect_to) {
        setError("Phoenix could not complete this authorization request.");
        return;
      }
      window.location.assign(payload.redirect_to);
    } catch {
      setError("Phoenix could not complete this authorization request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OAuth2ConsentCard
      clientName={clientName}
      clientId={clientId}
      signedInAs={signedInAs}
      isFirstParty={isFirstParty}
      redirectUri={redirectUri}
      errorMessage={error}
      isMissingRequiredParams={!hasRequiredParams}
      isSubmitting={isSubmitting}
      onApprove={() => {
        void submitDecision(true);
      }}
      onCancel={() => {
        void submitDecision(false);
      }}
    />
  );
}
