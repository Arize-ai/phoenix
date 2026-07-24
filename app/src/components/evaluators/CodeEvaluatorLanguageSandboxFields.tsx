import { useMemo } from "react";

import {
  Button,
  Flex,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { PythonSVG, TypeScriptSVG } from "@phoenix/components/core/icon/Icons";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import type { CodeEvaluatorLanguage, SandboxBackendType } from "@phoenix/types";

/** Structural shape of ``SandboxConfig.config`` as returned by GraphQL. */
export type SandboxConfigOptionConfig = {
  readonly envVars: ReadonlyArray<{
    readonly name: string;
    readonly secretKey: string;
  }>;
  readonly internetAccess: { readonly mode: "ALLOW" | "DENY" } | null;
  readonly dependencies: {
    readonly packages: ReadonlyArray<string>;
  } | null;
};

export type SandboxConfigOption = {
  id: string;
  name: string;
  description?: string | null;
  backendType: SandboxBackendType;
  providerLabel: string;
  language: CodeEvaluatorLanguage;
  timeout?: number | null;
  config: SandboxConfigOptionConfig;
  supportsEnvVars?: boolean;
  internetAccess?: string;
  supportsDependencies?: boolean;
};

export type CodeEvaluatorLanguageFieldProps = {
  /** Current language selection */
  language: CodeEvaluatorLanguage;
  /** Callback when language changes */
  onChange: (language: CodeEvaluatorLanguage) => void;
  isDisabled?: boolean;
  isRequired?: boolean;
};

/**
 * Language selector for code evaluators (Python or TypeScript)
 */
export const CodeEvaluatorLanguageField = ({
  language,
  onChange,
  isDisabled,
  isRequired,
}: CodeEvaluatorLanguageFieldProps) => {
  return (
    <Select
      value={language}
      isDisabled={isDisabled}
      isRequired={isRequired}
      onChange={(value) =>
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Select item ids are exactly CodeEvaluatorLanguage ("PYTHON" | "TYPESCRIPT")
        onChange(value as CodeEvaluatorLanguage)
      }
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
  /** Whether the selection is required for form submission. */
  isRequired?: boolean;
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
  isRequired,
}: CodeEvaluatorSandboxFieldProps) => {
  // Filter configs to only show those matching the current language
  const compatibleConfigs = useMemo(
    () => sandboxConfigs.filter((config) => config.language === language),
    [sandboxConfigs, language]
  );

  // Check if the selected config is still valid for the current language
  const validSelectedId = compatibleConfigs.some(
    (config) => config.id === selectedSandboxConfigId
  )
    ? selectedSandboxConfigId
    : null;

  const hasNoProviders = sandboxConfigs.length === 0;
  const hasNoCompatibleConfigs = compatibleConfigs.length === 0;

  return (
    <Select
      size={size}
      isRequired={isRequired}
      selectedKey={validSelectedId != null ? String(validSelectedId) : null}
      onSelectionChange={(key) => {
        onSelectionChange(typeof key === "string" ? key : null);
      }}
      isDisabled={hasNoCompatibleConfigs}
      placeholder={
        hasNoProviders
          ? "No sandboxes configured"
          : hasNoCompatibleConfigs
            ? "None available"
            : "Select a sandbox..."
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
                  backendType={item.backendType}
                  height={18}
                />
                <Text>{item.name}</Text>
              </Flex>
            </SelectItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
};

const BACKEND_TYPE_LABELS: Record<SandboxBackendType, string> = {
  WASM: "WebAssembly",
  E2B: "E2B",
  DAYTONA: "Daytona",
  VERCEL: "Vercel",
  DENO: "Deno",
  MODAL: "Modal",
};

const backendTypeLabel = (backendType: SandboxBackendType): string =>
  BACKEND_TYPE_LABELS[backendType] ?? backendType;

/**
 * Maps sandbox provider data from GraphQL to SandboxConfigOption[].
 * Only includes configs from enabled providers whose backends are available.
 * One option is produced per SandboxConfig row (config.language drives the
 * option's language).
 */
export const mapSandboxConfigOptions = (
  sandboxProviders: ReadonlyArray<{
    backendType: SandboxBackendType;
    enabled: boolean;
    configs: ReadonlyArray<{
      id: string;
      name: string;
      description?: string | null;
      language: CodeEvaluatorLanguage;
      timeout?: number | null;
      config: SandboxConfigOptionConfig;
    }>;
  }>,
  sandboxBackends: ReadonlyArray<{
    backendType: SandboxBackendType;
    status: string;
    supportsEnvVars?: boolean;
    internetAccess?: string;
    supportsDependencies?: boolean;
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
        providerLabel: backendTypeLabel(provider.backendType),
        language: config.language,
        timeout: config.timeout,
        config: config.config,
        supportsEnvVars: backend?.supportsEnvVars,
        internetAccess: backend?.internetAccess,
        supportsDependencies: backend?.supportsDependencies,
      }));
    })
    .sort((leftOption, rightOption) => {
      const providerComparison = leftOption.providerLabel.localeCompare(
        rightOption.providerLabel
      );
      if (providerComparison !== 0) {
        return providerComparison;
      }
      const backendTypeComparison = leftOption.backendType.localeCompare(
        rightOption.backendType
      );
      if (backendTypeComparison !== 0) {
        return backendTypeComparison;
      }
      const nameComparison = leftOption.name.localeCompare(rightOption.name);
      if (nameComparison !== 0) {
        return nameComparison;
      }
      return leftOption.id.localeCompare(rightOption.id);
    });
};
