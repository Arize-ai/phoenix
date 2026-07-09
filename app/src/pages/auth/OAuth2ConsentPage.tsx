import { css } from "@emotion/react";
import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useSearchParams } from "react-router";

import { Alert, Badge, Button, Flex, Heading, Text } from "@phoenix/components";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { OAuth2ConsentPageQuery } from "./__generated__/OAuth2ConsentPageQuery.graphql";
import { AuthLayout } from "./AuthLayout";

type AuthorizationDecisionResponse = {
  redirect_to?: string;
};

const consentPageCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
`;

const clientHeaderCSS = css`
  display: flex;
  gap: var(--global-dimension-size-200);
  align-items: center;
`;

const clientAvatarCSS = css`
  width: var(--global-dimension-size-600);
  height: var(--global-dimension-size-600);
  border-radius: var(--global-rounding-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--global-color-primary-700);
  color: var(--global-static-color-white-900);
  font-size: var(--global-font-size-xl);
  font-weight: 700;
  flex: none;
`;

const copyBlockCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-200);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-color-gray-50);
`;

const redirectDestinationCSS = css`
  font-family: var(--global-font-family-mono);
  color: var(--global-text-color-900);
`;

const actionRowCSS = css`
  display: flex;
  justify-content: space-between;
  gap: var(--global-dimension-size-100);
`;

function isLoopbackRedirect(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" ||
        url.hostname === "localhost" ||
        url.hostname === "::1" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function isPrivateUseRedirect(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return url.protocol !== "http:" && url.protocol !== "https:";
  } catch {
    return false;
  }
}

function formatLoopbackRedirectDestination(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    return redirectUri;
  }
}

function formatHostedRedirectDestination(redirectUri: string) {
  try {
    return new URL(redirectUri).host;
  } catch {
    return redirectUri;
  }
}

function getClientInitial(clientName: string) {
  return clientName.trim().charAt(0).toUpperCase() || "?";
}

function getRequiredParam(searchParams: URLSearchParams, name: string) {
  const value = searchParams.get(name);
  return value && value.trim() ? value : null;
}

export function OAuth2ConsentPage() {
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
  const showLoopbackProvenance =
    redirectUri != null && isLoopbackRedirect(redirectUri);
  const showPrivateUseRedirect =
    redirectUri != null && isPrivateUseRedirect(redirectUri);
  const redirectDestination =
    redirectUri == null
      ? "the application"
      : showLoopbackProvenance
        ? formatLoopbackRedirectDestination(redirectUri)
        : formatHostedRedirectDestination(redirectUri);

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
      const payload = (await response.json()) as AuthorizationDecisionResponse;
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
    <AuthLayout>
      <div css={consentPageCSS}>
        <div css={clientHeaderCSS}>
          <div css={clientAvatarCSS} aria-hidden="true">
            {getClientInitial(clientName)}
          </div>
          <Flex direction="column" gap="size-50">
            <Flex direction="row" gap="size-100" alignItems="center">
              <Heading level={1} weight="heavy">
                {clientName} is requesting READ-ONLY access
              </Heading>
              <Badge variant="info">Read-only</Badge>
            </Flex>
            <Text color="text-700">Signed in as {signedInAs}</Text>
            {!isFirstParty && clientId ? (
              <Text color="text-700" size="XS">
                Client ID: <code>{clientId.slice(-8)}</code>
              </Text>
            ) : null}
          </Flex>
        </div>
        {!isFirstParty ? (
          <Alert variant="warning" title="Unverified application">
            This application is not verified by Phoenix. Only approve if you
            recognize it and started this authorization flow.
          </Alert>
        ) : null}
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {!hasRequiredParams ? (
          <Alert variant="danger">
            This authorization request is missing required parameters.
          </Alert>
        ) : null}
        <div css={copyBlockCSS}>
          <Text elementType="p">
            It will be able to view project data — traces, datasets, prompts,
            and experiments — but not admin settings.
          </Text>
          <Text elementType="p">
            It will not be able to create, modify, or delete anything.
          </Text>
        </div>
        {showLoopbackProvenance ? (
          <Alert variant="info">
            Only approve if you started this yourself — for example, by running{" "}
            <code>px auth login</code> in your terminal. If this page appeared
            unexpectedly, click Cancel.
          </Alert>
        ) : null}
        <Text color="text-700">
          You will be redirected to{" "}
          {showPrivateUseRedirect ? (
            <>
              an application on this device (
              <code css={redirectDestinationCSS}>{redirectUri}</code>)
            </>
          ) : (
            <span css={redirectDestinationCSS}>{redirectDestination}</span>
          )}
        </Text>
        <div css={actionRowCSS}>
          <Button
            onPress={() => {
              void submitDecision(false);
            }}
            isDisabled={isSubmitting || !hasRequiredParams}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onPress={() => {
              void submitDecision(true);
            }}
            isDisabled={isSubmitting || !hasRequiredParams}
          >
            {isSubmitting ? "Authorizing..." : "Approve"}
          </Button>
        </div>
        <Text color="text-700" size="XS">
          You can revoke this access anytime in Settings.
        </Text>
      </div>
    </AuthLayout>
  );
}
