import { css } from "@emotion/react";
import { useId, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Button, Flex, Icon, Icons, Text } from "@phoenix/components";
import type { ModelMenuValue } from "@phoenix/components/generative";
import { ProviderServerCredentialsPanel } from "@phoenix/components/generative";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";

import type { AgentModelCredentialFormQuery } from "./__generated__/AgentModelCredentialFormQuery.graphql";
import {
  type AgentModelCredentialState,
  getProviderCredentialState,
} from "./agentModelSearch";

const credentialFormCSS = css`
  box-sizing: border-box;
  width: 100%;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-default);
  padding: var(--global-dimension-size-200);
  color: var(--global-text-color-900);
`;

const ambientCredentialNoteCSS = css`
  padding: var(--global-dimension-size-150);
`;

const credentialFormToggleCSS = css`
  align-self: flex-start;
`;

type AgentModelCredentialProvider =
  AgentModelCredentialFormQuery["response"]["modelProviders"][number];

/** A built-in provider without server-side credentials, and its state. */
export type AgentModelMissingCredentials = {
  provider: AgentModelCredentialProvider;
  /**
   * "no-key" blocks sending; "may-work" (AWS, Azure) doesn't, since the
   * server falls back to the provider's ambient credential chain
   */
  credentialState: Exclude<AgentModelCredentialState, "ready">;
};

/**
 * The server-side credential status of the selected model's provider, from
 * {@link getProviderCredentialState}: null when it's ready or custom.
 */
export function useAgentModelCredentialStatus(value: ModelMenuValue | null): {
  missingCredentials: AgentModelMissingCredentials | null;
  refreshCredentialStatus: () => void;
} {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<AgentModelCredentialFormQuery>(
    graphql`
      query AgentModelCredentialFormQuery {
        modelProviders {
          key
          name
          credentialRequirements {
            envVarName
            isRequired
          }
          credentialsSet
        }
      }
    `,
    {},
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const refreshCredentialStatus = () => setFetchKey((key) => key + 1);

  const provider =
    value && !value.customProvider
      ? data.modelProviders.find((provider) => provider.key === value.provider)
      : undefined;
  if (!provider || provider.credentialRequirements.length === 0) {
    return { missingCredentials: null, refreshCredentialStatus };
  }
  const credentialState = getProviderCredentialState(provider);
  return {
    missingCredentials:
      credentialState === "ready" ? null : { provider, credentialState },
    refreshCredentialStatus,
  };
}

/**
 * Where a "may-work" provider's ambient credentials come from, for the note
 * shown in place of the credential form.
 */
const AMBIENT_CREDENTIAL_SOURCES: Partial<Record<string, string>> = {
  AWS: "the AWS credential chain, such as an IAM role",
  AZURE_OPENAI: "an Azure managed identity",
};

/**
 * The credential form for a provider without server-side credentials: a
 * blocking form for "no-key", or a non-blocking note with the form collapsed
 * for "may-work".
 */
export function AgentModelCredentialForm({
  missingCredentials: { provider, credentialState },
  modelName,
  onCredentialsUpdated,
}: {
  missingCredentials: AgentModelMissingCredentials;
  modelName: string;
  onCredentialsUpdated: () => void;
}) {
  const isAdmin = useIsAdminOrAuthDisabled();

  if (credentialState === "may-work") {
    return (
      <AgentModelAmbientCredentialNote
        isAdmin={isAdmin}
        modelName={modelName}
        onCredentialsUpdated={onCredentialsUpdated}
        provider={provider}
      />
    );
  }

  return (
    <section
      css={credentialFormCSS}
      aria-label={`${provider.name} credentials`}
    >
      <Flex direction="column" gap="size-150">
        <Flex direction="row" alignItems="center" gap="size-100">
          <Icon color="danger" svg={<Icons.AlertTriangle />} />
          <Text weight="heavy">
            {provider.name} credentials are not configured
          </Text>
        </Flex>
        {isAdmin ? (
          <>
            <Text size="XS" color="text-700">
              Add server-side credentials for {modelName} to use this model with
              the assistant, or select a different model below.
            </Text>
            <ProviderServerCredentialsPanel
              provider={provider}
              onCredentialsUpdated={onCredentialsUpdated}
            />
          </>
        ) : (
          <Text size="XS" color="text-700">
            Contact an administrator to configure {provider.name} credentials
            before using {modelName} with the assistant, or select a different
            model below.
          </Text>
        )}
      </Flex>
    </section>
  );
}

/**
 * A non-blocking note for a provider that may authenticate without
 * credentials in Phoenix, with the credential form collapsed for admins.
 */
function AgentModelAmbientCredentialNote({
  isAdmin,
  modelName,
  onCredentialsUpdated,
  provider,
}: {
  isAdmin: boolean;
  modelName: string;
  onCredentialsUpdated: () => void;
  provider: AgentModelCredentialProvider;
}) {
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const formId = useId();
  const ambientSource =
    AMBIENT_CREDENTIAL_SOURCES[provider.key] ?? "its default credential chain";

  return (
    <section
      css={[credentialFormCSS, ambientCredentialNoteCSS]}
      aria-label={`${provider.name} credentials`}
    >
      <Flex direction="column" gap="size-100">
        <Flex direction="row" alignItems="start" gap="size-100">
          <Icon color="info" svg={<Icons.Info />} />
          <Flex direction="column" gap="size-50">
            <Text weight="heavy">
              {provider.name} credentials aren&apos;t configured in Phoenix
            </Text>
            <Text size="XS" color="text-700">
              {modelName} will only work if the server environment supplies
              credentials through {ambientSource}.
            </Text>
          </Flex>
        </Flex>
        {isAdmin ? (
          <>
            <Button
              size="S"
              variant="quiet"
              aria-expanded={isFormExpanded}
              aria-controls={isFormExpanded ? formId : undefined}
              onPress={() => setIsFormExpanded((isExpanded) => !isExpanded)}
              trailingVisual={
                <Icon
                  svg={
                    isFormExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />
                  }
                />
              }
              css={credentialFormToggleCSS}
            >
              Add credentials
            </Button>
            {isFormExpanded ? (
              <div id={formId}>
                <ProviderServerCredentialsPanel
                  provider={provider}
                  onCredentialsUpdated={onCredentialsUpdated}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </Flex>
    </section>
  );
}
