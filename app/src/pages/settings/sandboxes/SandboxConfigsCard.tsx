import { useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Card,
  DocumentationHelp,
  Flex,
  Label,
  Switch,
  Text,
} from "@phoenix/components";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { TableEmpty } from "@phoenix/components/table";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SandboxConfigsCardConfigEnabledSwitchMutation } from "./__generated__/SandboxConfigsCardConfigEnabledSwitchMutation.graphql";
import { DeleteSandboxConfigButton } from "./DeleteSandboxConfigButton";
import { SandboxConfigDialogTrigger } from "./SandboxConfigDialog";
import {
  configNameCSS,
  configNameCellCSS,
  sandboxesTableCSS,
  sandboxesTableWrapCSS,
  subtitleCSS,
} from "./styles";
import type { ConfigRow, ProviderRow } from "./types";
import {
  getSandboxConfigSettings,
  LanguageWithIcon,
  SandboxHostingTypeBadge,
  shouldShowRuntimeUnavailableBadge,
  StatusText,
} from "./utils";

export function SandboxConfigsCard({
  configRows,
  providerRows,
}: {
  configRows: ConfigRow[];
  providerRows: ProviderRow[];
}) {
  // Only providers whose backend is available AND whose admin toggle is
  // enabled can produce a working config — hide the rest so the create
  // dropdown isn't cluttered with options the user can't actually use.
  const selectableProviderRows = useMemo(
    () =>
      providerRows.filter(
        ({ backend, provider }) =>
          backend.status === "AVAILABLE" && provider.enabled
      ),
    [providerRows]
  );
  return (
    <Card
      title="Sandbox Configurations"
      titleExtra={
        <DocumentationHelp topic="sandboxConfigurations">
          Reusable sandbox configurations for code evaluators.
        </DocumentationHelp>
      }
      extra={
        <SandboxConfigDialogTrigger
          mode="create"
          providers={selectableProviderRows}
        />
      }
    >
      <div css={sandboxesTableWrapCSS}>
        <table css={sandboxesTableCSS}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Language</th>
              <th>Settings</th>
              <th />
            </tr>
          </thead>
          {configRows.length > 0 ? (
            <tbody>
              {configRows.map(({ backend, provider, config }) => {
                const settings = getSandboxConfigSettings(config.config);
                return (
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
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <SandboxProviderIcon
                          backendType={backend.backendType}
                          height={18}
                        />
                        <Text>{backend.displayName}</Text>
                        <SandboxHostingTypeBadge
                          hostingType={backend.hostingType}
                        />
                      </Flex>
                    </td>
                    <td>
                      <LanguageWithIcon language={config.language} />
                    </td>
                    <td>
                      <Flex direction="column" gap="size-50" alignItems="start">
                        <Text>{config.timeout}s timeout</Text>
                        {settings.length > 0 ? (
                          settings.map(({ key, label, value }) => (
                            <Flex
                              key={key}
                              direction="row"
                              gap="size-50"
                              alignItems="baseline"
                            >
                              <Text size="S" color="text-700">
                                {label}:
                              </Text>
                              <Text size="S" fontFamily="mono">
                                {value}
                              </Text>
                            </Flex>
                          ))
                        ) : (
                          <Text color="text-700">No custom settings</Text>
                        )}
                      </Flex>
                    </td>
                    <td>
                      <Flex
                        gap="size-100"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Flex
                          direction="column"
                          gap="size-50"
                          alignItems="start"
                        >
                          <ConfigEnabledSwitch
                            config={config}
                            canEnable={provider.enabled}
                          />
                          {shouldShowRuntimeUnavailableBadge(backend) ? (
                            <StatusText
                              status={backend.status}
                              detail={backend.statusDetail}
                              dependencyHints={backend.dependencyHints}
                            />
                          ) : null}
                        </Flex>
                        <Flex
                          justifyContent="end"
                          gap="size-100"
                          alignItems="center"
                        >
                          <SandboxConfigDialogTrigger
                            mode="edit"
                            provider={provider}
                            backend={backend}
                            config={config}
                          />
                          <DeleteSandboxConfigButton config={config} />
                        </Flex>
                      </Flex>
                    </td>
                  </tr>
                );
              })}
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
