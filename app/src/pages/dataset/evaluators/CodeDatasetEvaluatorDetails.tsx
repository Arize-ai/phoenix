import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import invariant from "tiny-invariant";

import {
  Card,
  ContextualHelp,
  Empty,
  Flex,
  Icon,
  Icons,
  LinkButton,
  List,
  ListItem,
  Text,
  View,
} from "@phoenix/components";
import { CodeEvaluatorSourceCodeBlock } from "@phoenix/components/evaluators/CodeEvaluatorSourceCodeBlock";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { useViewerCanManageSandboxes } from "@phoenix/contexts";
import type { CodeDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/CodeDatasetEvaluatorDetails_datasetEvaluator.graphql";
import type { datasetEvaluatorDetailsLoaderQuery } from "@phoenix/pages/dataset/evaluators/__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";
import {
  getSandboxConfigSettings,
  LanguageWithIcon,
} from "@phoenix/pages/settings/sandboxes/utils";

type SandboxBackendInfo =
  datasetEvaluatorDetailsLoaderQuery["response"]["sandboxBackends"][number];

type OutputConfig = {
  name?: string;
  optimizationDirection?: string | null;
  values?: ReadonlyArray<{
    label?: string | null;
    score?: number | null;
  }> | null;
  lowerBound?: number | null;
  upperBound?: number | null;
  threshold?: number | null;
};

const splitLayoutCSS = css`
  display: grid;
  gap: var(--global-dimension-size-200);
  grid-template-columns: minmax(0, 1fr) clamp(300px, 24vw, 380px);
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const mapGridCSS = css`
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--global-dimension-size-150);

  @media (max-width: 1100px) {
    grid-template-columns: 1fr 1fr;
  }

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
              sandboxBackend?.supportsDependencies ?? false
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
  const isContinuous = config.lowerBound != null || config.upperBound != null;
  const isFreeform = !isCategorical && !isContinuous;
  const direction = formatOptimizationDirection(config.optimizationDirection);

  return (
    <div css={annotationGridCSS}>
      <AnnotationCell label="Name" value={config.name} />
      {isCategorical && (
        <>
          <AnnotationCell label="Type" value="Categorical" />
          <AnnotationCell label="Optimization Direction" value={direction} />
          <AnnotationCell
            label="Values"
            value={formatCategoricalValues(config.values)}
          />
        </>
      )}
      {isContinuous && (
        <>
          <AnnotationCell label="Type" value="Continuous" />
          <AnnotationCell label="Optimization Direction" value={direction} />
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
      {isFreeform && (
        <>
          <AnnotationCell label="Type" value="Freeform" />
          <AnnotationCell label="Optimization Direction" value={direction} />
          <AnnotationCell
            label="Threshold"
            value={config.threshold != null ? String(config.threshold) : "—"}
          />
        </>
      )}
    </div>
  );
}

/** Values that should render in muted-italic (off / none) vs plain mono. */
const MUTED_SETTING_VALUES = new Set(["off", "none"]);

/** Setting keys whose values are comma-separated lists best shown one-per-line. */
const LIST_SETTING_KEYS = new Set(["env_vars", "dependencies"]);

function SettingValue({
  settingKey,
  value,
}: {
  settingKey: string;
  value: string;
}) {
  const isMuted = MUTED_SETTING_VALUES.has(value);
  if (LIST_SETTING_KEYS.has(settingKey) && !isMuted) {
    const items = value.split(", ").filter((s) => s.length > 0);
    return (
      <Flex direction="column" alignItems="end" gap="size-25">
        {items.map((item) => (
          <Text key={item} size="S" fontFamily="mono">
            {item}
          </Text>
        ))}
      </Flex>
    );
  }
  return (
    <Text
      size="S"
      fontFamily="mono"
      color={isMuted ? "text-500" : undefined}
      fontStyle={isMuted ? "italic" : undefined}
    >
      {value}
    </Text>
  );
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
    case "NONE":
      return "Not supported";
    default:
      return internetAccess;
  }
}

function getDependenciesLabel(
  supportsDependencies: SandboxBackendInfo["supportsDependencies"]
) {
  return supportsDependencies ? "Supported" : "Not supported";
}

export function CodeDatasetEvaluatorDetails({
  datasetEvaluatorRef,
  sandboxBackends,
}: {
  datasetEvaluatorRef: CodeDatasetEvaluatorDetails_datasetEvaluator$key;
  sandboxBackends: ReadonlyArray<SandboxBackendInfo>;
}) {
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
          ... on FreeformAnnotationConfig {
            name
            optimizationDirection
            threshold
          }
        }
        evaluator {
          kind
          ... on CodeEvaluator {
            id
            name
            description
            language
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
              ... on FreeformAnnotationConfig {
                name
                optimizationDirection
                threshold
              }
            }
            sandboxConfig {
              id
              name
              description
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
              provider {
                backendType
              }
            }
            currentVersion {
              sourceCode
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
  const currentVersion = evaluator.currentVersion;

  const outputConfigs =
    datasetEvaluator.outputConfigs.length > 0
      ? datasetEvaluator.outputConfigs
      : (evaluator.outputConfigs ?? []);
  const sandboxConfig = evaluator.sandboxConfig ?? null;
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

  const pathMappingEntries = useMemo(() => {
    const pathMapping: unknown = datasetEvaluator.inputMapping.pathMapping;
    return typeof pathMapping === "object" && pathMapping !== null
      ? Object.entries(pathMapping)
      : [];
  }, [datasetEvaluator.inputMapping.pathMapping]);
  const literalMappingEntries = useMemo(() => {
    const literalMapping: unknown =
      datasetEvaluator.inputMapping.literalMapping;
    return typeof literalMapping === "object" && literalMapping !== null
      ? Object.entries(literalMapping)
      : [];
  }, [datasetEvaluator.inputMapping.literalMapping]);

  const canManageSandboxes = useViewerCanManageSandboxes();

  const customSettings = useMemo(
    () =>
      sandboxConfig == null
        ? []
        : getSandboxConfigSettings(sandboxConfig.config),
    [sandboxConfig]
  );

  // currentVersion can be null (e.g. fixtures, backfills) — render an
  // empty state rather than throwing.
  if (!currentVersion || !currentVersion.sourceCode) {
    return (
      <Flex flex={1} alignItems="center" justifyContent="center">
        <Empty message="This code evaluator has no current version yet." />
      </Flex>
    );
  }
  invariant(evaluator.language, "code evaluator language is required");

  return (
    <div css={splitLayoutCSS}>
      <Flex direction="column" gap="size-200" minWidth={0}>
        <Card
          title="Source Code"
          extra={<LanguageWithIcon language={evaluator.language} />}
        >
          <CodeEvaluatorSourceCodeBlock
            language={evaluator.language}
            sourceCode={currentVersion.sourceCode}
          />
        </Card>
      </Flex>
      <Flex direction="column" gap="size-200" minWidth={0}>
        <Card
          title={
            <Flex direction="row" gap="size-100" alignItems="center">
              <Icon svg={<Icons.HardDrive />} />
              <span>Sandbox</span>
            </Flex>
          }
          extra={
            canManageSandboxes ? (
              <LinkButton
                size="S"
                to="/settings/sandboxes"
                aria-label="Configure sandboxes"
                leadingVisual={<Icon svg={<Icons.Settings />} />}
              />
            ) : undefined
          }
        >
          {sandboxConfig == null ? (
            <View padding="size-200">
              <Text color="text-700">No sandbox configuration selected.</Text>
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
                    <ProviderCapabilitiesHelp sandboxBackend={sandboxBackend} />
                  }
                  value={
                    <Flex direction="row" gap="size-100" alignItems="center">
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
              {customSettings.map((setting) => (
                <ListItem key={setting.key}>
                  <SandboxRow
                    label={setting.label}
                    value={
                      <SettingValue
                        settingKey={setting.key}
                        value={setting.value}
                      />
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Card>
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
                <OutputConfigBlock key={config.name || idx} config={config} />
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
    </div>
  );
}
