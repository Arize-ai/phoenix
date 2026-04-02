import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { Card, Flex, Label, Switch, Text } from "@phoenix/components";
import { TableEmpty } from "@phoenix/components/table";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SandboxConfigsCardConfigEnabledSwitchMutation } from "./__generated__/SandboxConfigsCardConfigEnabledSwitchMutation.graphql";
import { DeleteSandboxConfigButton } from "./DeleteSandboxConfigButton";
import { SandboxConfigDialogTrigger } from "./SandboxConfigDialog";
import {
  configNameCSS,
  configNameCellCSS,
  inlineTokenRowCSS,
  pageIntroCSS,
  sandboxesTableCSS,
  sandboxesTableWrapCSS,
  subtitleCSS,
} from "./styles";
import type { ConfigRow, ProviderRow } from "./types";
import {
  formatTimestamp,
  hasConfig,
  languageLabel,
  StatusText,
  summarizeConfig,
} from "./utils";

export function SandboxConfigsCard({
  configRows,
  providerRows,
}: {
  configRows: ConfigRow[];
  providerRows: ProviderRow[];
}) {
  return (
    <Card
      title="Code Sandboxes"
      extra={
        <SandboxConfigDialogTrigger mode="create" providers={providerRows} />
      }
    >
      <div css={pageIntroCSS}>
        <Flex justifyContent="space-between" alignItems="center" gap="size-200">
          <Text color="text-700">
            Configure reusable sandbox configurations for code evaluators.
          </Text>
        </Flex>
      </div>
      <div css={sandboxesTableWrapCSS}>
        <table css={sandboxesTableCSS}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Settings</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          {configRows.length > 0 ? (
            <tbody>
              {configRows.map(({ backend, provider, config }) => (
                <tr key={config.id}>
                  <td css={configNameCellCSS}>
                    <Flex direction="column" gap="size-25">
                      <span css={configNameCSS}>{config.name}</span>
                      <span css={subtitleCSS}>
                        {config.description || "No description"}
                      </span>
                    </Flex>
                  </td>
                  <td>
                    <Flex direction="column" gap="size-25">
                      <Text>{backend.displayName}</Text>
                      <Text color="text-700" size="S">
                        {languageLabel(provider.language)} provider
                      </Text>
                    </Flex>
                  </td>
                  <td>
                    <div css={inlineTokenRowCSS}>
                      <StatusText status={backend.status} />
                    </div>
                  </td>
                  <td>
                    <Flex direction="column" gap="size-25">
                      <Text>{config.timeout}s timeout</Text>
                      <Text
                        color={
                          hasConfig(config.config) ? undefined : "text-700"
                        }
                      >
                        {hasConfig(config.config)
                          ? summarizeConfig(config.config)
                          : "No advanced settings"}
                      </Text>
                    </Flex>
                  </td>
                  <td>{formatTimestamp(config.updatedAt)}</td>
                  <td>
                    <Flex
                      gap="size-100"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <ConfigEnabledSwitch
                        config={config}
                        canEnable={provider.enabled}
                      />
                      <Flex
                        justifyContent="end"
                        gap="size-100"
                        alignItems="center"
                      >
                        <SandboxConfigDialogTrigger
                          mode="edit"
                          provider={provider}
                          config={config}
                        />
                        <DeleteSandboxConfigButton config={config} />
                      </Flex>
                    </Flex>
                  </td>
                </tr>
              ))}
            </tbody>
          ) : (
            <TableEmpty message="No sandbox configs" />
          )}
        </table>
      </div>
    </Card>
  );
}

function ConfigEnabledSwitch({
  config,
  canEnable,
}: {
  config: ConfigRow["config"];
  canEnable: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [commitUpdate, isSubmitting] =
    useMutation<SandboxConfigsCardConfigEnabledSwitchMutation>(graphql`
      mutation SandboxConfigsCardConfigEnabledSwitchMutation(
        $input: UpdateSandboxConfigInput!
      ) {
        updateSandboxConfig(input: $input) {
          query {
            ...SettingsSandboxesPageFragment
          }
        }
      }
    `);

  return (
    <Flex direction="column" gap="size-50">
      <Switch
        isSelected={config.enabled}
        isDisabled={!canEnable || isSubmitting}
        onChange={(enabled) => {
          setError(null);
          commitUpdate({
            variables: {
              input: {
                id: config.id,
                enabled,
              },
            },
            onError: (mutationError) => {
              setError(
                getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
                  "Failed to update config"
              );
            },
          });
        }}
      >
        <Label>{config.enabled ? "Enabled" : "Disabled"}</Label>
      </Switch>
      {error ? (
        <Text color="danger" size="S">
          {error}
        </Text>
      ) : null}
    </Flex>
  );
}
