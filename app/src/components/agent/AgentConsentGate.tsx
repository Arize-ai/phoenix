import { css } from "@emotion/react";

import { Button, Flex, LinkButton, Text } from "@phoenix/components";
import type { ModelMenuValue } from "@phoenix/components/generative";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { AgentModelMenu } from "./AgentModelMenu";
import { AgentObservabilitySettings } from "./AgentObservabilitySettings";

const consentCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
  /* The gate can be taller than the chat panel; scroll inside the input
     surface rather than clipping at the panel edge. */
  min-height: 0;
  overflow-y: auto;
`;

const consentHeaderCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const consentListCSS = css`
  margin: 0;
  padding-left: 0;
  list-style: none;
  color: var(--global-text-color-700);

  li + li {
    margin-top: var(--global-dimension-size-75);
  }
`;

const consentActionsCSS = css`
  display: flex;
  justify-content: flex-end;
  gap: var(--global-dimension-size-100);
  flex-wrap: wrap;
`;

const consentSectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

export function AgentConsentGate({
  modelMenuValue,
  onModelChange,
}: {
  modelMenuValue: ModelMenuValue;
  onModelChange: (model: ModelMenuValue) => void;
}) {
  const acknowledgeConsent = useAgentContext(
    (state) => state.acknowledgeConsent
  );
  const hasRemoteCollector = useAgentContext((state) =>
    Boolean(state.agentsConfig.collectorEndpoint)
  );

  return (
    <div css={consentCSS}>
      <div css={consentHeaderCSS}>
        <Text elementType="h3" size="L" weight="heavy">
          Before you use the assistant
        </Text>
        <Text color="text-700">
          The assistant can and will make mistakes. What it can do may vary a
          lot depending on the task and the context it has, so it should be used
          with care.
        </Text>
      </div>
      <ul css={consentListCSS}>
        <li>
          {hasRemoteCollector
            ? "Review how your assistant session traces are saved and shared before you continue."
            : "Review how your assistant session traces are saved before you continue."}
        </li>
        <li>You can change these settings later in Assistant settings.</li>
      </ul>
      <div css={consentSectionCSS}>
        <Text elementType="h4" size="M" weight="heavy">
          Model
        </Text>
        <Text color="text-700">
          Choose the model the assistant uses. You can change it anytime from
          the chat input.
        </Text>
        <Flex direction="row">
          <AgentModelMenu
            value={modelMenuValue}
            onChange={onModelChange}
            placement="top start"
            shouldFlip
          />
        </Flex>
      </div>
      <div css={consentSectionCSS}>
        <Text elementType="h4" size="M" weight="heavy">
          Tracing
        </Text>
      </div>
      <AgentObservabilitySettings />
      <Flex direction="row" css={consentActionsCSS}>
        <LinkButton to="/settings/agents" variant="default">
          Assistant settings
        </LinkButton>
        <Button
          variant="primary"
          onPress={() => {
            acknowledgeConsent();
          }}
        >
          Acknowledge
        </Button>
      </Flex>
    </div>
  );
}
