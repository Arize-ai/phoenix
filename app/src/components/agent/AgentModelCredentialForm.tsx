import { css } from "@emotion/react";
import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Icon, Icons, Text } from "@phoenix/components";
import type { ModelMenuValue } from "@phoenix/components/generative";
import { ProviderServerCredentialsPanel } from "@phoenix/components/generative";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";

import type { AgentModelCredentialFormQuery } from "./__generated__/AgentModelCredentialFormQuery.graphql";

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

type AgentModelCredentialProvider =
  AgentModelCredentialFormQuery["response"]["modelProviders"][number];

export function useAgentModelCredentialStatus(value: ModelMenuValue | null) {
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

  if (!value || value.customProvider) {
    return {
      missingCredentialsProvider: null,
      refreshCredentialStatus: () => setFetchKey((key) => key + 1),
    };
  }

  const provider = data.modelProviders.find(
    (provider) => provider.key === value.provider
  );
  if (
    !provider ||
    provider.credentialsSet ||
    provider.credentialRequirements.length === 0
  ) {
    return {
      missingCredentialsProvider: null,
      refreshCredentialStatus: () => setFetchKey((key) => key + 1),
    };
  }

  return {
    missingCredentialsProvider: provider,
    refreshCredentialStatus: () => setFetchKey((key) => key + 1),
  };
}

export function AgentModelCredentialForm({
  modelName,
  onCredentialsUpdated,
  provider,
}: {
  modelName: string;
  onCredentialsUpdated: () => void;
  provider: AgentModelCredentialProvider;
}) {
  const isAdmin = useIsAdminOrAuthDisabled();

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
