import { Flex, Text, Token } from "@phoenix/components";

import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];

type StatusDisplay = {
  label: string;
  color: string;
  icon: boolean;
};

export function BackendHeader({
  adapter,
  display,
}: {
  adapter: AdapterInfo;
  display: StatusDisplay;
}) {
  return (
    <Flex direction="row" alignItems="center" gap="size-200" width="100%">
      {/* Name + description column */}
      <Flex direction="column" gap="size-25" flex="1 1 auto">
        <Text weight="heavy">{adapter.label}</Text>
        <Text size="XS" color="text-500">
          {adapter.description}
        </Text>
      </Flex>
      {/* Status badge */}
      <Token
        color={
          adapter.status === "AVAILABLE"
            ? "var(--global-color-green-500)"
            : adapter.status === "NEEDS_CREDENTIALS" ||
                adapter.status === "NEEDS_CONFIG"
              ? "var(--global-color-orange-500)"
              : "var(--global-color-gray-300)"
        }
        size="S"
      >
        {display.label}
      </Token>
      {/* Supported language badges */}
      {adapter.supportedLanguages.map((lang) => (
        <Token key={lang} color="var(--global-color-blue-300)" size="S">
          {lang}
        </Token>
      ))}
      {/* Credential status indicator */}
      {adapter.envVars.length > 0 && (
        <Text
          size="XS"
          color={
            adapter.status === "AVAILABLE" || adapter.status === "NEEDS_CONFIG"
              ? "success"
              : "text-300"
          }
        >
          {adapter.status === "AVAILABLE" || adapter.status === "NEEDS_CONFIG"
            ? "credentials configured"
            : "credentials missing"}
        </Text>
      )}
    </Flex>
  );
}
