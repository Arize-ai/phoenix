import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Flex,
  Loading,
  RichTooltip,
  RichTooltipTitle,
  Text,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { getSandboxConfigSettings } from "@phoenix/pages/settings/sandboxes/utils";
import type { SandboxBackendType } from "@phoenix/types";

import type { SandboxConfigLabelDetailsQuery } from "./__generated__/SandboxConfigLabelDetailsQuery.graphql";

type SandboxConfigLabelProps = {
  /**
   * The Relay node id of the SandboxConfig. Used to lazily load the config
   * details when the tooltip is opened.
   */
  sandboxConfigId: string;
  /**
   * The display name of the sandbox config.
   */
  name: string;
  /**
   * The canonical kind of the sandbox provider, used to render the provider icon.
   */
  backendType: SandboxBackendType;
};

/**
 * Renders a sandbox config as a provider icon + name, with a tooltip that
 * lazily loads the config's settings (dependencies, internet access, env vars,
 * timeout, ...) on hover.
 */
export function SandboxConfigLabel({
  sandboxConfigId,
  name,
  backendType,
}: SandboxConfigLabelProps) {
  return (
    <TooltipTrigger delay={500}>
      <TriggerWrap>
        <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
          <SandboxProviderIcon backendType={backendType} height={18} />
          <Text minWidth={0}>
            <Truncate>{name}</Truncate>
          </Text>
        </Flex>
      </TriggerWrap>
      <RichTooltip>
        <TooltipArrow />
        <RichTooltipTitle>{name}</RichTooltipTitle>
        <Suspense fallback={<Loading />}>
          <SandboxConfigLabelDetails sandboxConfigId={sandboxConfigId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}

const settingsListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
`;

const settingRowCSS = css`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--global-dimension-size-200);
`;

function SandboxConfigLabelDetails({
  sandboxConfigId,
}: {
  sandboxConfigId: string;
}) {
  const data = useLazyLoadQuery<SandboxConfigLabelDetailsQuery>(
    graphql`
      query SandboxConfigLabelDetailsQuery($id: ID!) {
        node(id: $id) {
          __typename
          ... on SandboxConfig {
            timeout
            config {
              envVars {
                name
                secretKey
              }
              internetAccess {
                mode
              }
              dependencies {
                packages
              }
            }
          }
        }
      }
    `,
    { id: sandboxConfigId }
  );

  if (data.node.__typename !== "SandboxConfig") {
    return <Text size="S">Sandbox config not found</Text>;
  }
  const sandboxConfig = data.node;

  const settings = getSandboxConfigSettings(sandboxConfig.config);

  return (
    <ul css={settingsListCSS}>
      <li css={settingRowCSS}>
        <Text size="S" color="text-700">
          Timeout
        </Text>
        <Text size="S">{sandboxConfig.timeout}s</Text>
      </li>
      {settings.map((setting) => (
        <li css={settingRowCSS} key={setting.key}>
          <Text size="S" color="text-700">
            {setting.label}
          </Text>
          <Text size="S">{setting.value}</Text>
        </li>
      ))}
    </ul>
  );
}
