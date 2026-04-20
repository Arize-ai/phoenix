import { css } from "@emotion/react";

import { Button, Flex, LinkButton, Text } from "@phoenix/components";
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

const consentListCSS = css`
  margin: 0;
  padding-left: var(--global-dimension-size-200);
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

export function AgentConsentGate() {
  const acknowledgeConsent = useAgentContext(
    (state) => state.acknowledgeConsent
  );

  return (
    <div css={consentCSS}>
      <div css={consentHeaderCSS}>
        <Text elementType="h3" size="L" weight="heavy">
          Before you use PXI
        </Text>
        <Text color="text-700">
          PXI can and will make mistakes. What it can do may vary a lot
          depending on the task and the context it has, so it should be used
          with care.
        </Text>
      </div>
      <ul css={consentListCSS}>
        <li>
          Review how your PXI session traces are saved and shared before you
          continue.
        </li>
        <li>You can change these settings later from Agent Settings.</li>
      </ul>
      <div css={consentSectionCSS}>
        <Text elementType="h4" size="M" weight="heavy">
          Tracing
        </Text>
      </div>
      <AgentObservabilitySettings />
      <Flex direction="row" css={consentActionsCSS}>
        <LinkButton to="/settings/agents" variant="default">
          Agent Settings
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
