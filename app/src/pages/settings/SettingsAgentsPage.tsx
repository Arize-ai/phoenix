import { css } from "@emotion/react";

import {
  Card,
  CopyField,
  CopyInput,
  ExternalLink,
  Flex,
  Label,
  Switch,
  Text,
  View,
} from "@phoenix/components";
import {
  AgentObservabilitySettings,
  AgentSettingsForm,
} from "@phoenix/components/agent";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

const traceDetailsCSS = css`
  summary {
    cursor: pointer;
  }
`;

function getProjectRedirectUrl(
  collectorEndpoint: string,
  projectName: string
): string | null {
  try {
    const url = new URL(collectorEndpoint);
    url.pathname = url.pathname
      .replace(/\/v1\/traces\/?$/, "")
      .replace(/\/$/, "");
    url.pathname = `${url.pathname}/redirects/projects/${encodeURIComponent(projectName)}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function AssistantAgentEnabledSwitch() {
  const isAssistantAgentEnabled = usePreferencesContext(
    (state) => state.isAssistantAgentEnabled
  );
  const setIsAssistantAgentEnabled = usePreferencesContext(
    (state) => state.setIsAssistantAgentEnabled
  );
  return (
    <Switch
      labelPlacement="start"
      isSelected={isAssistantAgentEnabled}
      onChange={setIsAssistantAgentEnabled}
    >
      Enabled
    </Switch>
  );
}

function AssistantTraceCollectionInfo() {
  const { collectorEndpoint, assistantProjectName } = useAgentContext(
    (state) => state.agentsConfig
  );
  const projectRedirectUrl = collectorEndpoint
    ? getProjectRedirectUrl(collectorEndpoint, assistantProjectName)
    : null;

  return (
    <Flex direction="column" gap="size-200">
      <AgentObservabilitySettings />
      <details css={traceDetailsCSS}>
        <summary>Tracing Details</summary>
        <View paddingTop="size-150">
          <Flex direction="column" gap="size-200">
            <CopyField value={assistantProjectName}>
              <Label>Assistant Project Name</Label>
              <CopyInput />
              <Text slot="description">
                {projectRedirectUrl ? (
                  <>
                    View traces in{" "}
                    <ExternalLink href={projectRedirectUrl}>
                      {assistantProjectName}
                    </ExternalLink>
                  </>
                ) : (
                  "The project where assistant agent traces are recorded"
                )}
              </Text>
            </CopyField>
            <CopyField value={collectorEndpoint ?? ""}>
              <Label>Collector Endpoint</Label>
              <CopyInput />
              <Text slot="description">
                {collectorEndpoint
                  ? "This is the sharing destination used when trace sharing is turned on."
                  : "Trace sharing is not configured for this Phoenix app."}
              </Text>
            </CopyField>
          </Flex>
        </View>
      </details>
    </Flex>
  );
}

export function SettingsAgentsPage() {
  const isAssistantAgentEnabled = usePreferencesContext(
    (state) => state.isAssistantAgentEnabled
  );
  return (
    <Card
      title="Assistant"
      collapsible
      defaultOpen={isAssistantAgentEnabled}
      extra={<AssistantAgentEnabledSwitch />}
    >
      <View padding="size-200">
        <Flex
          direction="column"
          gap="size-300"
          css={css`
            width: 100%;
          `}
        >
          <AssistantTraceCollectionInfo />
          <AgentSettingsForm />
        </Flex>
      </View>
    </Card>
  );
}
