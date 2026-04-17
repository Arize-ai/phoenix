import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Card,
  CopyField,
  CopyInput,
  ExternalLink,
  Flex,
  Label,
  Loading,
  Switch,
  Text,
  View,
} from "@phoenix/components";
import { AgentSettingsForm } from "@phoenix/components/agent";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import type { SettingsAgentsPageQuery } from "./__generated__/SettingsAgentsPageQuery.graphql";

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
  const data = useLazyLoadQuery<SettingsAgentsPageQuery>(
    graphql`
      query SettingsAgentsPageQuery {
        agentsConfig {
          collectorEndpoint
          assistantProjectName
        }
      }
    `,
    {}
  );

  const { collectorEndpoint, assistantProjectName } = data.agentsConfig;
  const projectRedirectUrl = collectorEndpoint
    ? getProjectRedirectUrl(collectorEndpoint, assistantProjectName)
    : null;

  return (
    <Flex direction="column" gap="size-200">
      <Text>Assistant agent traces are collected to the project below.</Text>
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
            ? "Traces are also exported to this remote collector"
            : "No remote collector configured — traces are only persisted locally"}
        </Text>
      </CopyField>
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
          <Suspense fallback={<Loading />}>
            <AssistantTraceCollectionInfo />
          </Suspense>
          <AgentSettingsForm />
        </Flex>
      </View>
    </Card>
  );
}
