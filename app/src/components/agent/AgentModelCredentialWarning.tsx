import { css } from "@emotion/react";
import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { DialogTrigger, Icon, Icons, Popover } from "@phoenix/components";
import { PromptInputButton } from "@phoenix/components/ai/prompt-input";
import type { ModelMenuValue } from "@phoenix/components/generative";
import { ProviderCredentialsDialog } from "@phoenix/components/generative";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import type { AgentModelCredentialWarningQuery } from "./__generated__/AgentModelCredentialWarningQuery.graphql";

export function AgentModelCredentialWarning({
  value,
}: {
  value: ModelMenuValue | null;
}) {
  const [fetchKey, setFetchKey] = useState(0);
  const isDisabled = useAgentContext((state) =>
    Object.values(state.chatStatusBySessionId).some(
      (status) => status === "submitted" || status === "streaming"
    )
  );

  const data = useLazyLoadQuery<AgentModelCredentialWarningQuery>(
    graphql`
      query AgentModelCredentialWarningQuery {
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
    return null;
  }

  const provider = data.modelProviders.find(
    (provider) => provider.key === value.provider
  );
  if (
    !provider ||
    provider.credentialsSet ||
    provider.credentialRequirements.length === 0
  ) {
    return null;
  }

  return (
    <DialogTrigger>
      <PromptInputButton
        type="button"
        aria-label={`Configure ${provider.name} credentials`}
        tooltip={`${provider.name} credentials are not configured`}
        isDisabled={isDisabled}
      >
        <Icon color="danger" svg={<Icons.AlertTriangleOutline />} />
      </PromptInputButton>
      <Popover
        placement="top start"
        css={css`
          width: min(420px, calc(100vw - var(--global-dimension-size-400)));
        `}
      >
        <ProviderCredentialsDialog
          provider={provider}
          mode="server-only"
          onCredentialsUpdated={() => {
            setFetchKey((key) => key + 1);
          }}
        />
      </Popover>
    </DialogTrigger>
  );
}
