import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Icon, Icons, Text } from "@phoenix/components";
import type { ModelMenuValue } from "@phoenix/components/generative";
import { ProviderServerCredentialsPanel } from "@phoenix/components/generative";
import { useViewer } from "@phoenix/contexts";

import type { AgentModelCredentialInlineFormQuery } from "./__generated__/AgentModelCredentialInlineFormQuery.graphql";

const credentialFormCSS = css`
  box-sizing: border-box;
  width: 100%;
  border: var(--global-border-size-thin) solid var(--global-color-danger-500);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-default);
  padding: var(--global-dimension-size-200);
  color: var(--global-text-color-900);
`;

export function AgentModelCredentialInlineForm({
  fallback,
  value,
}: {
  fallback: ReactNode;
  value: ModelMenuValue | null;
}) {
  const [fetchKey, setFetchKey] = useState(0);
  const { viewer } = useViewer();
  const isAdmin = !viewer || viewer.role?.name === "ADMIN";
  const data = useLazyLoadQuery<AgentModelCredentialInlineFormQuery>(
    graphql`
      query AgentModelCredentialInlineFormQuery {
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
    return fallback;
  }

  const provider = data.modelProviders.find(
    (provider) => provider.key === value.provider
  );
  if (
    !provider ||
    provider.credentialsSet ||
    provider.credentialRequirements.length === 0
  ) {
    return fallback;
  }

  return (
    <section
      css={credentialFormCSS}
      aria-label={`${provider.name} credentials`}
    >
      <Flex direction="column" gap="size-150">
        <Flex direction="row" alignItems="center" gap="size-100">
          <Icon color="danger" svg={<Icons.AlertTriangleOutline />} />
          <Text weight="heavy">
            {provider.name} credentials are not configured
          </Text>
        </Flex>
        {isAdmin ? (
          <>
            <Text size="XS" color="text-700">
              Add server-side credentials for {value.modelName} to use this
              model with PXI.
            </Text>
            <ProviderServerCredentialsPanel
              provider={provider}
              onCredentialsUpdated={() => {
                setFetchKey((key) => key + 1);
              }}
            />
          </>
        ) : (
          <Text size="XS" color="text-700">
            Contact an administrator to configure {provider.name} credentials
            before using {value.modelName} with PXI.
          </Text>
        )}
      </Flex>
    </section>
  );
}
