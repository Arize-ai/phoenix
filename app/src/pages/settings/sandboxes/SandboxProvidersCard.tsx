import { css } from "@emotion/react";
import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Card,
  Flex,
  Label,
  RichTooltip,
  Switch,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SandboxProvidersCardProviderEnabledSwitchMutation } from "./__generated__/SandboxProvidersCardProviderEnabledSwitchMutation.graphql";
import { cardIntroCSS, sandboxesTableCSS } from "./styles";
import type { BackendInfo, ProviderRow, SandboxProvider } from "./types";
import {
  formatTimestamp,
  getBackendDescription,
  languageLabel,
  statusLabel,
} from "./utils";

export function SandboxProvidersCard({
  providers,
}: {
  providers: ProviderRow[];
}) {
  return (
    <Card title="Sandbox Providers">
      <div css={cardIntroCSS}>
        <Text color="text-700">
          Manage shared provider settings and whether each sandbox runtime can
          be enabled.
        </Text>
      </div>
      <table css={sandboxesTableCSS}>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Runtime</th>
            <th>Status</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {providers.map(({ backend, provider }) => {
            const canEnable = backend.status === "AVAILABLE";
            return (
              <tr key={provider.id}>
                <td>
                  <Flex direction="column" gap="size-25">
                    <span>{backend.displayName}</span>
                    <Text color="text-700" size="S">
                      {languageLabel(provider.language)} provider
                    </Text>
                  </Flex>
                </td>
                <td>
                  <Text>{getBackendDescription(backend.backendType)}</Text>
                </td>
                <td>
                  <ProviderStatusText backend={backend} />
                </td>

                <td>{formatTimestamp(provider.updatedAt)}</td>
                <td>
                  {canEnable ? (
                    <ProviderEnabledSwitch
                      provider={provider}
                      canEnable={canEnable}
                    />
                  ) : (
                    <Text color="text-700" size="S">
                      Unavailable
                    </Text>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function ProviderStatusText({ backend }: { backend: BackendInfo }) {
  const label = statusLabel(backend.status);

  if (backend.status === "AVAILABLE") {
    return <Text color="success">{label}</Text>;
  }

  if (backend.dependencyHints.length === 0) {
    return <Text color="text-700">{label}</Text>;
  }

  return (
    <TooltipTrigger delay={100}>
      <TriggerWrap>
        <Text
          color="text-700"
          css={css`
            text-decoration: underline dotted;
            text-underline-offset: 2px;
            cursor: help;
          `}
        >
          {label}
        </Text>
      </TriggerWrap>
      <RichTooltip width={320}>
        <Flex direction="column" gap="size-50">
          {backend.dependencyHints.map((hint: string) => (
            <Text key={hint}>{hint}</Text>
          ))}
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}

function ProviderEnabledSwitch({
  provider,
  canEnable,
}: {
  provider: SandboxProvider;
  canEnable: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [commitUpdate, isSubmitting] =
    useMutation<SandboxProvidersCardProviderEnabledSwitchMutation>(graphql`
      mutation SandboxProvidersCardProviderEnabledSwitchMutation(
        $input: UpdateSandboxProviderInput!
      ) {
        updateSandboxProvider(input: $input) {
          query {
            ...SettingsSandboxesPageFragment
          }
        }
      }
    `);

  return (
    <Flex direction="column" gap="size-50">
      <Switch
        isSelected={provider.enabled}
        isDisabled={!canEnable || isSubmitting}
        onChange={(enabled) => {
          setError(null);
          commitUpdate({
            variables: {
              input: {
                id: provider.id,
                enabled,
              },
            },
            onError: (mutationError) => {
              setError(
                getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
                  "Failed to update provider"
              );
            },
          });
        }}
      >
        <Label>{provider.enabled ? "Enabled" : "Disabled"}</Label>
      </Switch>
      {error ? (
        <Text color="danger" size="S">
          {error}
        </Text>
      ) : null}
    </Flex>
  );
}
