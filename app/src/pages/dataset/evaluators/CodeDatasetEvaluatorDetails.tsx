import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";

import {
  Card,
  ContextualHelp,
  Flex,
  Icon,
  Icons,
  List,
  ListItem,
  Text,
  View,
} from "@phoenix/components";
import { EditCodeDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditCodeDatasetEvaluatorSlideover";
import { CodeEvaluatorSourceCodeBlock } from "@phoenix/components/evaluators/CodeEvaluatorSourceCodeBlock";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import type { CodeDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/CodeDatasetEvaluatorDetails_datasetEvaluator.graphql";
import type { datasetEvaluatorDetailsLoaderQuery } from "@phoenix/pages/dataset/evaluators/__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";
import {
  getDisplaySandboxConfig,
  LanguageWithIcon,
  languageLabel,
  summarizeConfig,
} from "@phoenix/pages/settings/sandboxes/utils";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

type SandboxBackendInfo =
  datasetEvaluatorDetailsLoaderQuery["response"]["sandboxBackends"][number];

type OutputConfig = {
  name: string;
  optimizationDirection?: string | null;
  values?: ReadonlyArray<{
    label?: string | null;
    score?: number | null;
  }> | null;
  lowerBound?: number | null;
  upperBound?: number | null;
};

const splitLayoutCSS = css`
  display: grid;
  gap: var(--global-dimension-size-200);
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const mapGridCSS = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--global-dimension-size-150);

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const annotationGridCSS = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--global-dimension-size-200);
`;

function SandboxRow({
  label,
  labelExtra,
  value,
}: {
  label: ReactNode;
  labelExtra?: ReactNode;
  value: ReactNode;
}) {
  return (
    <Flex
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap="size-200"
    >
      <Flex direction="row" alignItems="center" gap="size-50" flexShrink={0}>
        {typeof label === "string" ? (
          <Text size="S" color="text-700">
            {label}
          </Text>
        ) : (
          label
        )}
        {labelExtra}
      </Flex>
      <Flex
        direction="row"
        alignItems="center"
        justifyContent="end"
        gap="size-100"
        minWidth={0}
      >
        {typeof value === "string" ? <Text size="S">{value}</Text> : value}
      </Flex>
    </Flex>
  );
}

function CapabilityRow({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="row" gap="size-200" justifyContent="space-between">
      <Text size="XS" color="text-700">
        {label}
      </Text>
      <Text size="XS">{value}</Text>
    </Flex>
  );
}

function ProviderCapabilitiesHelp({
  sandboxBackend,
}: {
  sandboxBackend: SandboxBackendInfo | undefined;
}) {
  return (
    <ContextualHelp variant="info">
      <Flex direction="column" gap="size-100">
        <Text weight="heavy" size="S">
          Capabilities
        </Text>
        <Flex direction="column" gap="size-50">
          <CapabilityRow
            label="env_vars"
            value={
              sandboxBackend?.supportsEnvVars ? "supported" : "not supported"
            }
          />
          <CapabilityRow
            label="internet_access"
            value={getInternetAccessLabel(
              sandboxBackend?.internetAccess ?? "NONE"
            )}
          />
          <CapabilityRow
            label="dependencies"
            value={getDependenciesLabel(
              sandboxBackend?.dependenciesLanguage ?? null
            )}
          />
        </Flex>
      </Flex>
    </ContextualHelp>
  );
}

function MappingTile({
  title,
  description,
  entries,
  emptyLabel,
  formatValue,
}: {
  title: string;
  description: string;
  entries: ReadonlyArray<[string, unknown]>;
  emptyLabel: string;
  formatValue: (value: unknown) => string;
}) {
  return (
    <Flex direction="column" gap="size-100" elementType="section">
      <Flex direction="column" gap="size-25">
        <Text weight="heavy" size="S" elementType="h4">
          {title}
        </Text>
        <Text size="XS" color="text-700">
          {description}
        </Text>
      </Flex>
      {entries.length === 0 ? (
        <Text size="XS" color="text-500">
          {emptyLabel}
        </Text>
      ) : (
        <Flex direction="column" gap="size-75">
          {entries.map(([key, value]) => (
            <Flex
              key={key}
              direction="row"
              gap="size-100"
              alignItems="baseline"
            >
              <Text size="S" fontFamily="mono" color="text-700">
                {key}
              </Text>
              <Text size="S" color="text-500" aria-hidden="true">
                →
              </Text>
              <Text size="S" fontFamily="mono">
                {formatValue(value)}
              </Text>
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}

function AnnotationCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Flex direction="column" gap="size-50">
      <Text size="XS" color="text-700" weight="heavy">
        {label}
      </Text>
      {typeof value === "string" ? <Text>{value}</Text> : value}
    </Flex>
  );
}

function formatOptimizationDirection(direction: string | null | undefined) {
  if (!direction) return "None";
  return direction.charAt(0).toUpperCase() + direction.slice(1).toLowerCase();
}

function formatCategoricalValues(values: OutputConfig["values"]): string {
  if (!values || values.length === 0) return "—";
  return values
    .map((v) => `${v.label}${v.score != null ? ` (${v.score})` : ""}`)
    .join(", ");
}

function formatBound(value: number | null | undefined): string {
  return value != null ? String(value) : "Unbounded";
}

function OutputConfigBlock({ config }: { config: OutputConfig }) {
  const isCategorical = config.values != null;
  const direction = formatOptimizationDirection(config.optimizationDirection);

  return (
    <div css={annotationGridCSS}>
      <AnnotationCell label="Name" value={config.name} />
      <AnnotationCell
        label="Type"
        value={isCategorical ? "Categorical" : "Continuous"}
      />
      <AnnotationCell label="Optimization Direction" value={direction} />
      {isCategorical ? (
        <AnnotationCell
          label="Values"
          value={formatCategoricalValues(config.values)}
        />
      ) : (
        <>
          <AnnotationCell
            label="Lower bound"
            value={formatBound(config.lowerBound)}
          />
          <AnnotationCell
            label="Upper bound"
            value={formatBound(config.upperBound)}
          />
        </>
      )}
    </div>
  );
}

// Keys that are presented as a single row (not flattened into dot-paths) so
// we can apply a friendly human-readable summary value.
const COLLAPSED_SETTING_KEYS = new Set(["env_vars", "internet_access"]);

const FRIENDLY_SETTING_LABELS: Record<string, string> = {
  env_vars: "Environment Variables",
  internet_access: "Internet Access",
  dependencies: "Dependencies",
};

function friendlySettingLabel(key: string): string {
  if (FRIENDLY_SETTING_LABELS[key]) return FRIENDLY_SETTING_LABELS[key];
  return key
    .split(".")
    .map((part) =>
      part
        .split("_")
        .map((s) =>
          s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
        )
        .join(" ")
    )
    .join(" / ");
}

function flattenSettings(
  value: unknown,
  prefix = ""
): Array<[string, unknown]> {
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    return prefix ? [[prefix, value]] : [];
  }
  const result: Array<[string, unknown]> = [];
  for (const [key, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!prefix && COLLAPSED_SETTING_KEYS.has(key)) {
      result.push([path, v]);
    } else if (isPlainObject(v) && Object.keys(v).length > 0) {
      result.push(...flattenSettings(v, path));
    } else {
      result.push([path, v]);
    }
  }
  return result;
}

function isInternetAccessOff(value: unknown): boolean {
  if (value == null) return true;
  if (isPlainObject(value)) {
    const mode = value["mode"];
    if (mode == null) return true;
    if (typeof mode === "string" && mode.toLowerCase() === "deny") return true;
  }
  if (typeof value === "string" && value.toLowerCase() === "deny") return true;
  return false;
}

function MutedSettingValue({ children }: { children: ReactNode }) {
  return (
    <Text size="S" fontFamily="mono" color="text-500" fontStyle="italic">
      {children}
    </Text>
  );
}

function MonoSettingValue({ children }: { children: ReactNode }) {
  return (
    <Text size="S" fontFamily="mono">
      {children}
    </Text>
  );
}

function SettingValue({ keyPath, value }: { keyPath: string; value: unknown }) {
  if (keyPath === "env_vars") {
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      return <MutedSettingValue>none</MutedSettingValue>;
    }
  }
  if (keyPath === "internet_access") {
    if (isInternetAccessOff(value)) {
      return <MutedSettingValue>off</MutedSettingValue>;
    }
  }
  if (value == null) {
    return <MutedSettingValue>null</MutedSettingValue>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <MutedSettingValue>empty list</MutedSettingValue>;
    }
    return <MonoSettingValue>{JSON.stringify(value)}</MonoSettingValue>;
  }
  if (typeof value === "object") {
    if (Object.keys(value as object).length === 0) {
      return <MutedSettingValue>empty</MutedSettingValue>;
    }
    return <MonoSettingValue>{JSON.stringify(value)}</MonoSettingValue>;
  }
  return <MonoSettingValue>{String(value)}</MonoSettingValue>;
}

function formatPathMappingValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function formatLiteral(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

function getInternetAccessLabel(
  internetAccess: SandboxBackendInfo["internetAccess"]
) {
  switch (internetAccess) {
    case "BOOLEAN":
      return "Configurable";
    case "ALLOWLIST":
      return "Allowlist";
    case "NONE":
      return "Not supported";
    default:
      return internetAccess;
  }
}

function getDependenciesLabel(
  dependenciesLanguage: SandboxBackendInfo["dependenciesLanguage"]
) {
  return dependenciesLanguage == null
    ? "Not supported"
    : languageLabel(dependenciesLanguage);
}

export function CodeDatasetEvaluatorDetails({
  datasetEvaluatorRef,
  datasetId,
  sandboxBackends,
  isEditSlideoverOpen,
  onEditSlideoverOpenChange,
}: {
  datasetEvaluatorRef: CodeDatasetEvaluatorDetails_datasetEvaluator$key;
  datasetId: string;
  sandboxBackends: ReadonlyArray<SandboxBackendInfo>;
  isEditSlideoverOpen: boolean;
  onEditSlideoverOpenChange: (isOpen: boolean) => void;
}) {
  const { revalidate } = useRevalidator();
  const datasetEvaluator = useFragment(
    graphql`
      fragment CodeDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {
        id
        inputMapping {
          literalMapping
          pathMapping
        }
        outputConfigs {
          ... on CategoricalAnnotationConfig {
            name
            optimizationDirection
            values {
              label
              score
            }
          }
          ... on ContinuousAnnotationConfig {
            name
            optimizationDirection
            lowerBound
            upperBound
          }
        }
        evaluator {
          kind
          ... on CodeEvaluator {
            id
            name
            description
            language
            sourceCode
            sandboxConfig {
              id
              name
              description
              config
              timeout
              provider {
                backendType
                language
              }
            }
            outputConfigs {
              ... on CategoricalAnnotationConfig {
                name
                optimizationDirection
                values {
                  label
                  score
                }
              }
              ... on ContinuousAnnotationConfig {
                name
                optimizationDirection
                lowerBound
                upperBound
              }
            }
          }
        }
      }
    `,
    datasetEvaluatorRef
  );

  const evaluator = datasetEvaluator.evaluator;
  if (evaluator.kind !== "CODE") {
    throw new Error("Invalid evaluator for CodeDatasetEvaluatorDetails");
  }
  if (!evaluator.language || !evaluator.sourceCode) {
    throw new Error("Code evaluator is missing language or source code");
  }

  const outputConfigs =
    datasetEvaluator.outputConfigs.length > 0
      ? datasetEvaluator.outputConfigs
      : (evaluator.outputConfigs ?? []);
  const sandboxConfig = evaluator.sandboxConfig;
  const sandboxBackendByType = useMemo(
    () =>
      new Map(
        sandboxBackends.map((sandboxBackend) => [
          sandboxBackend.backendType,
          sandboxBackend,
        ])
      ),
    [sandboxBackends]
  );
  const sandboxBackend =
    sandboxConfig != null
      ? sandboxBackendByType.get(sandboxConfig.provider.backendType)
      : undefined;

  const pathMappingEntries = useMemo(
    () =>
      Object.entries(
        (datasetEvaluator.inputMapping.pathMapping as Record<
          string,
          unknown
        >) ?? {}
      ),
    [datasetEvaluator.inputMapping.pathMapping]
  );
  const literalMappingEntries = useMemo(
    () =>
      Object.entries(
        (datasetEvaluator.inputMapping.literalMapping as Record<
          string,
          unknown
        >) ?? {}
      ),
    [datasetEvaluator.inputMapping.literalMapping]
  );

  const customSettings = useMemo(() => {
    if (sandboxConfig == null) return null;
    if (summarizeConfig(sandboxConfig.config) === "No custom settings") {
      return null;
    }
    return getDisplaySandboxConfig(sandboxConfig.config);
  }, [sandboxConfig]);

  const flattenedCustomSettings = useMemo(
    () => flattenSettings(customSettings),
    [customSettings]
  );

  return (
    <>
      <Flex direction="column" gap="size-200">
        <Card
          title="Source Code"
          extra={<LanguageWithIcon language={evaluator.language} />}
        >
          <CodeEvaluatorSourceCodeBlock
            language={evaluator.language}
            sourceCode={evaluator.sourceCode}
          />
        </Card>
        <div css={splitLayoutCSS}>
          <Flex direction="column" gap="size-200" flex="2 1 0" minWidth={0}>
            <Card
              title={
                outputConfigs.length > 1
                  ? `Evaluator Annotations (${outputConfigs.length})`
                  : "Evaluator Annotation"
              }
            >
              <View padding="size-200">
                <Flex direction="column" gap="size-200">
                  {outputConfigs.map((config, idx) => (
                    <OutputConfigBlock
                      key={config.name || idx}
                      config={config as OutputConfig}
                    />
                  ))}
                </Flex>
              </View>
            </Card>
            <Card title="Input Mapping">
              <View padding="size-200">
                <div css={mapGridCSS}>
                  <MappingTile
                    title="Path mapping"
                    description="Map function args to fields on the example"
                    entries={pathMappingEntries}
                    emptyLabel="No paths set"
                    formatValue={formatPathMappingValue}
                  />
                  <MappingTile
                    title="Literal mapping"
                    description="Pass fixed literal values to function args"
                    entries={literalMappingEntries}
                    emptyLabel="No literals set"
                    formatValue={formatLiteral}
                  />
                </div>
              </View>
            </Card>
          </Flex>
          <Flex direction="column" gap="size-200" flex="1 1 0" minWidth={0}>
            <Card
              title={
                <Flex direction="row" gap="size-100" alignItems="center">
                  <Icon svg={<Icons.HardDriveOutline />} />
                  <span>Sandbox</span>
                </Flex>
              }
            >
              {sandboxConfig == null ? (
                <View padding="size-200">
                  <Text color="text-700">
                    No sandbox configuration selected.
                  </Text>
                </View>
              ) : (
                <List size="M">
                  <ListItem>
                    <SandboxRow
                      label="Config"
                      value={
                        <Text size="S" fontFamily="mono">
                          {sandboxConfig.name}
                        </Text>
                      }
                    />
                  </ListItem>
                  {sandboxConfig.description ? (
                    <ListItem>
                      <SandboxRow
                        label="Description"
                        value={sandboxConfig.description}
                      />
                    </ListItem>
                  ) : null}
                  <ListItem>
                    <SandboxRow
                      label="Provider"
                      labelExtra={
                        <ProviderCapabilitiesHelp
                          sandboxBackend={sandboxBackend}
                        />
                      }
                      value={
                        <Flex
                          direction="row"
                          gap="size-100"
                          alignItems="center"
                        >
                          <SandboxProviderIcon
                            backendType={sandboxConfig.provider.backendType}
                            height={16}
                          />
                          <Text size="S">
                            {sandboxBackend?.displayName ??
                              sandboxConfig.provider.backendType}
                          </Text>
                        </Flex>
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <SandboxRow
                      label="Timeout"
                      value={`${sandboxConfig.timeout} seconds`}
                    />
                  </ListItem>
                  {flattenedCustomSettings.map(([key, v]) => (
                    <ListItem key={key}>
                      <SandboxRow
                        label={friendlySettingLabel(key)}
                        value={<SettingValue keyPath={key} value={v} />}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Card>
          </Flex>
        </div>
      </Flex>
      <EditCodeDatasetEvaluatorSlideover
        datasetEvaluatorId={datasetEvaluator.id}
        datasetId={datasetId}
        isOpen={isEditSlideoverOpen}
        onOpenChange={onEditSlideoverOpenChange}
        onUpdate={() => revalidate()}
      />
    </>
  );
}
