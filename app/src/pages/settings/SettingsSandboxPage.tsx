import { useCallback, useState } from "react";
import type { Key } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import { Card, DisclosureGroup, Flex, Switch, Text } from "@phoenix/components";
import { CanManageSandboxConfig } from "@phoenix/components/auth";

import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";
import type { SettingsSandboxPageSetEnabledMutation } from "./__generated__/SettingsSandboxPageSetEnabledMutation.graphql";
import { BackendAccordionSection } from "./BackendAccordionSection";

const EXPANDED_KEYS_STORAGE_KEY = "phoenix-sandbox-backends-expanded";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];

function statusDisplay(status: string) {
  switch (status) {
    case "AVAILABLE":
      return { label: "active", color: "green-700" as const, icon: true };
    case "NOT_INSTALLED":
      return {
        label: "not installed",
        color: "gray-400" as const,
        icon: false,
      };
    case "NEEDS_CREDENTIALS":
      return {
        label: "needs credentials",
        color: "warning" as const,
        icon: false,
      };
    case "NEEDS_CONFIG":
      return { label: "needs config", color: "warning" as const, icon: false };
    default:
      return { label: status, color: "gray-400" as const, icon: false };
  }
}

export function SettingsSandboxPage() {
  const [fetchKey, setFetchKey] = useState(0);

  const data = useLazyLoadQuery<SettingsSandboxPageQuery>(
    graphql`
      query SettingsSandboxPageQuery {
        sandboxEnabled
        sandboxBackends {
          key
          label
          description
          status
          enabled
          envVars {
            name
            required
            description
          }
          configFields {
            key
            label
            placeholder
            description
          }
          configRequired
          setupInstructions
          supportedLanguages
          configs {
            id
            backendType
            name
            description
            config
            timeout
            enabled
            configHash
            createdAt
            updatedAt
          }
        }
      }
    `,
    {},
    {
      fetchKey,
      fetchPolicy: "network-only",
    }
  );

  const backends = data.sandboxBackends;
  const sandboxEnabled = data.sandboxEnabled;

  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(() => {
    try {
      const stored = localStorage.getItem(EXPANDED_KEYS_STORAGE_KEY);
      if (stored) return new Set<Key>(JSON.parse(stored) as Key[]);
    } catch {
      // ignore parse errors
    }
    return new Set<Key>(
      backends
        .filter((a: AdapterInfo) => a.status !== "NOT_INSTALLED")
        .map((a: AdapterInfo) => a.key)
    );
  });

  const handleExpandedChange = useCallback((keys: Set<Key>) => {
    setExpandedKeys(keys);
    try {
      localStorage.setItem(
        EXPANDED_KEYS_STORAGE_KEY,
        JSON.stringify([...keys])
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  const [commitSetEnabled] =
    useMutation<SettingsSandboxPageSetEnabledMutation>(graphql`
      mutation SettingsSandboxPageSetEnabledMutation($enabled: Boolean!) {
        setSandboxEnabled(enabled: $enabled)
      }
    `);

  const handleGlobalToggle = useCallback(
    (enabled: boolean) => {
      commitSetEnabled({
        variables: { enabled },
        onCompleted: () => setFetchKey((k) => k + 1),
      });
    },
    [commitSetEnabled]
  );

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  return (
    <CanManageSandboxConfig>
      <Flex direction="column" gap="size-200">
        <Card
          title="Python Sandbox Backends"
          extra={
            <Flex direction="row" alignItems="center" gap="size-100">
              <Text size="S" color={sandboxEnabled ? "text-700" : "text-300"}>
                {sandboxEnabled ? "Enabled" : "Disabled"}
              </Text>
              <Switch
                isSelected={sandboxEnabled}
                onChange={handleGlobalToggle}
                aria-label="Enable sandbox"
              >
                {null}
              </Switch>
            </Flex>
          }
        >
          <DisclosureGroup
            expandedKeys={expandedKeys}
            onExpandedChange={handleExpandedChange}
          >
            {backends.map((adapter: AdapterInfo) => {
              const display = statusDisplay(adapter.status);
              return (
                <BackendAccordionSection
                  key={adapter.key}
                  adapter={adapter}
                  display={display}
                  sandboxEnabled={sandboxEnabled}
                  onRefetch={refetch}
                />
              );
            })}
          </DisclosureGroup>
        </Card>
      </Flex>
    </CanManageSandboxConfig>
  );
}
