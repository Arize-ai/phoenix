import { css } from "@emotion/react";

import { Button, Flex, Text } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { AgentObservabilitySettings } from "./AgentObservabilitySettings";

const consentCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
`;

const consentHeaderCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
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

export function AgentConsentGate() {
  const acknowledgeConsent = useAgentContext(
    (state) => state.acknowledgeConsent
  );

  return (
    <div css={consentCSS}>
      <div css={consentHeaderCSS}>
        <Text elementType="h3" size="L" weight="heavy">
          Before you use the assistant
        </Text>
        <Text color="text-700">
          The assistant can make mistakes, so use it with care. Review how your
          session traces are handled below — you can change these settings
          anytime.
        </Text>
      </div>
      <div css={consentSectionCSS}>
        <Text elementType="h4" size="M" weight="heavy">
          Tracing
        </Text>
      </div>
      <AgentObservabilitySettings />
      <Flex direction="row" css={consentActionsCSS}>
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
