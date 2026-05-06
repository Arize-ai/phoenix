import { useMemo } from "react";

import {
  Button,
  Flex,
  Label,
  Link,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  View,
} from "@phoenix/components";
import { PythonSVG, TypeScriptSVG } from "@phoenix/components/core/icon/Icons";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

export type SandboxConfigOption = {
  id: string;
  name: string;
  description?: string | null;
  backendType: string;
  providerLabel: string;
  providerLanguage: CodeEvaluatorLanguage;
  providerBackendType: string;
  timeout?: number | null;
  config?: unknown;
  supportsEnvVars?: boolean;
  internetAccess?: string;
  dependenciesLanguage?: CodeEvaluatorLanguage | null;
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
          <SelectItem id="PYTHON" textValue="Python">
            <Flex direction="row" gap="size-100" alignItems="center">
              <PythonSVG />
              <Text>Python</Text>
            </Flex>
          </SelectItem>
          <SelectItem id="TYPESCRIPT" textValue="TypeScript">
            <Flex direction="row" gap="size-100" alignItems="center">
              <TypeScriptSVG />
              <Text>TypeScript</Text>
            </Flex>
          </SelectItem>
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
  size = "M",
  showHelperText = false,
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
          No sandbox providers enabled.{" "}
          <Link to="/settings/sandboxes">Configure in Settings</Link>.
        </Text>
      </Flex>
    );
  }

  return (
    <View>
      <Select
        size={size}
        selectedKey={validSelectedId != null ? String(validSelectedId) : null}
        onSelectionChange={(key) => {
          onSelectionChange(typeof key === "string" ? key : null);
        }}
        isDisabled={compatibleConfigs.length === 0}
        placeholder={
          compatibleConfigs.length > 0
            ? "Select a sandbox..."
            : "None available"
        }
      >
        <Label>Sandbox</Label>
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox items={compatibleConfigs}>
            {(item) => (
              <SelectItem
                id={String(item.id)}
                key={item.id}
                textValue={item.name}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <SandboxProviderIcon
                    backendType={item.providerBackendType}
                    height={18}
                  />
                  <Text>{item.name}</Text>
                </Flex>
              </SelectItem>
            )}
          </ListBox>
        </Popover>
      </Select>
      {showHelperText && (
        <Text color="text-500" size="S">
          Code evaluators run in a sandbox. Configure reusable sandbox configs
          in Settings if none are available here.
        </Text>
      )}
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
      timeout?: number | null;
      config?: unknown;
    }>;
  }>,
  sandboxBackends: ReadonlyArray<{
    backendType: string;
    status: string;
    supportsEnvVars?: boolean;
    internetAccess?: string;
    dependenciesLanguage?: CodeEvaluatorLanguage | null;
  }>
): SandboxConfigOption[] => {
  const availableBackendsByType = new Map(
    sandboxBackends
      .filter((backend) => backend.status === "AVAILABLE")
      .map((backend) => [backend.backendType, backend])
  );

  return sandboxProviders
    .filter(
      (provider) =>
        provider.enabled && availableBackendsByType.has(provider.backendType)
    )
    .flatMap((provider) => {
      const backend = availableBackendsByType.get(provider.backendType);
      return provider.configs.map((config) => ({
        id: config.id,
        name: config.name,
        description: config.description,
        backendType: provider.backendType,
        providerLanguage: provider.language,
        providerLabel: backendTypeLabel(provider.backendType),
        providerBackendType: provider.backendType,
        timeout: config.timeout,
        config: config.config,
        supportsEnvVars: backend?.supportsEnvVars,
        internetAccess: backend?.internetAccess,
        dependenciesLanguage: backend?.dependenciesLanguage,
      }));
    });
};
