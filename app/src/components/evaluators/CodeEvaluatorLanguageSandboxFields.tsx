import { useMemo } from "react";

import {
  Button,
  ComboBox,
  ComboBoxItem,
  Flex,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  View,
} from "@phoenix/components";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

export type SandboxConfigOption = {
  id: string;
  name: string;
  description?: string | null;
  providerLabel: string;
  providerLanguage: CodeEvaluatorLanguage;
};

export type CodeEvaluatorLanguageFieldProps = {
  /** Current language selection */
  language: CodeEvaluatorLanguage;
  /** Callback when language changes */
  onChange: (language: CodeEvaluatorLanguage) => void;
};

/**
 * Language selector for code evaluators (Python or TypeScript)
 */
export const CodeEvaluatorLanguageField = ({
  language,
  onChange,
}: CodeEvaluatorLanguageFieldProps) => {
  return (
    <Select
      value={language}
      onChange={(value) => onChange(value as CodeEvaluatorLanguage)}
    >
      <Label>Language</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          <SelectItem id="PYTHON">Python</SelectItem>
          <SelectItem id="TYPESCRIPT">TypeScript</SelectItem>
        </ListBox>
      </Popover>
    </Select>
  );
};

export type CodeEvaluatorSandboxFieldProps = {
  /** All available sandbox configs (will be filtered by language) */
  sandboxConfigs: SandboxConfigOption[];
  /** Current language to filter configs by */
  language: CodeEvaluatorLanguage;
  /** Currently selected sandbox config Relay ID */
  selectedSandboxConfigId: string | null;
  /** Callback when selection changes */
  onSelectionChange: (sandboxConfigId: string | null) => void;
  /** Optional size variant */
  size?: "M" | "L";
  /** Whether to show the helper text below the field */
  showHelperText?: boolean;
  /** Optional warning shown when a saved selection is no longer available */
  unavailableSelectionMessage?: string;
};

/**
 * Sandbox config selector for code evaluators.
 * Automatically filters configs by the selected language.
 */
export const CodeEvaluatorSandboxField = ({
  sandboxConfigs,
  language,
  selectedSandboxConfigId,
  onSelectionChange,
  size = "L",
  showHelperText = false,
  unavailableSelectionMessage,
}: CodeEvaluatorSandboxFieldProps) => {
  // Filter configs to only show those matching the current language
  const compatibleConfigs = useMemo(
    () =>
      sandboxConfigs.filter((config) => config.providerLanguage === language),
    [sandboxConfigs, language]
  );

  // Check if the selected config is still valid for the current language
  const validSelectedId = compatibleConfigs.some(
    (config) => config.id === selectedSandboxConfigId
  )
    ? selectedSandboxConfigId
    : null;

  if (sandboxConfigs.length === 0) {
    // No sandbox providers enabled at all
    return (
      <Flex direction="column" gap="size-50">
        <Label>Sandbox</Label>
        <Text color="text-500" size="S">
          No sandbox providers enabled. Configure in Settings.
        </Text>
      </Flex>
    );
  }

  return (
    <View>
      <ComboBox
        label="Sandbox"
        size={size}
        placeholder={
          compatibleConfigs.length > 0 ? "Select..." : "None available"
        }
        selectedKey={validSelectedId != null ? String(validSelectedId) : null}
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            onSelectionChange(key);
          } else {
            onSelectionChange(null);
          }
        }}
        defaultItems={compatibleConfigs}
        menuTrigger="focus"
        isDisabled={compatibleConfigs.length === 0}
        renderEmptyState={() => (
          <View padding="size-100">
            <Text color="text-500" size="S">
              No configs for {language === "PYTHON" ? "Python" : "TypeScript"}
            </Text>
          </View>
        )}
      >
        {(item) => (
          <ComboBoxItem
            id={String(item.id)}
            key={item.id}
            textValue={item.name}
          >
            <Flex direction="column" gap="size-25">
              <Text>{item.name}</Text>
              {item.description ? (
                <Text color="text-700" size="XS">
                  {item.description}
                </Text>
              ) : (
                <Text color="text-700" size="XS">
                  {item.providerLabel}
                </Text>
              )}
            </Flex>
          </ComboBoxItem>
        )}
      </ComboBox>
      {showHelperText && (
        <Text color="text-500" size="S">
          Code evaluators run in a sandbox. Configure reusable sandbox configs
          in Settings if none are available here.
        </Text>
      )}
      {unavailableSelectionMessage ? (
        <Text color="danger" size="S">
          {unavailableSelectionMessage}
        </Text>
      ) : null}
    </View>
  );
};

const BACKEND_TYPE_LABELS: Record<string, string> = {
  WASM: "WebAssembly",
  E2B: "E2B",
  DAYTONA_PYTHON: "Daytona",
  VERCEL_PYTHON: "Vercel",
  VERCEL_TYPESCRIPT: "Vercel",
  DENO: "Deno",
  MODAL: "Modal",
};

const backendTypeLabel = (backendType: string): string =>
  BACKEND_TYPE_LABELS[backendType] ?? backendType;

/**
 * Maps sandbox provider data from GraphQL to SandboxConfigOption[].
 * Only includes configs from enabled providers whose backends are available.
 */
export const mapSandboxConfigOptions = (
  sandboxProviders: ReadonlyArray<{
    language: CodeEvaluatorLanguage;
    backendType: string;
    enabled: boolean;
    configs: ReadonlyArray<{
      id: string;
      name: string;
      description?: string | null;
    }>;
  }>,
  sandboxBackends: ReadonlyArray<{
    backendType: string;
    status: string;
  }>
): SandboxConfigOption[] => {
  // Build a set of available backend types
  const availableBackendTypes = new Set(
    sandboxBackends
      .filter((backend) => backend.status === "AVAILABLE")
      .map((backend) => backend.backendType)
  );

  return sandboxProviders
    .filter(
      (provider) =>
        provider.enabled && availableBackendTypes.has(provider.backendType)
    )
    .flatMap((provider) =>
      provider.configs.map((config) => ({
        id: config.id,
        name: config.name,
        description: config.description,
        providerLanguage: provider.language,
        providerLabel: backendTypeLabel(provider.backendType),
      }))
    );
};
