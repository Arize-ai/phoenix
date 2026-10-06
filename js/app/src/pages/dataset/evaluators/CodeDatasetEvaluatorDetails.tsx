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
import { getDeclaredInputBindings } from "@phoenix/components/evaluators/utils";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { useViewerCanManageSandboxes } from "@phoenix/contexts";
import type { CodeDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/CodeDatasetEvaluatorDetails_datasetEvaluator.graphql";
import type { datasetEvaluatorDetailsLoaderQuery } from "@phoenix/pages/dataset/evaluators/__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";
import {
  DatasetEvaluatorDetailsLayout,
  DeclaredInputMappingList,
  EvaluatorAnnotationsCard,
  InputMappingCard,
} from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorDetailsLayout";
import {
  getSandboxConfigSettings,
  LanguageWithIcon,
} from "@phoenix/pages/settings/sandboxes/utils";
import { isObject } from "@phoenix/typeUtils";

type SandboxBackendInfo =
  datasetEvaluatorDetailsLoaderQuery["response"]["sandboxBackends"][number];

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
          __typename
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
            inputSchema
            outputConfigs {
              __typename
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

  const inputBindings = useMemo(() => {
    const schema: unknown = evaluator.inputSchema;
    const properties =
      isObject(schema) && "properties" in schema ? schema.properties : null;
    const variables =
      isObject(properties) && !Array.isArray(properties)
        ? Object.keys(properties)
        : null;
    return getDeclaredInputBindings({
      variables,
      inputMapping: datasetEvaluator.inputMapping,
    });
  }, [evaluator.inputSchema, datasetEvaluator.inputMapping]);

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
    <DatasetEvaluatorDetailsLayout
      main={
        <Card
          title="Source Code"
          extra={<LanguageWithIcon language={evaluator.language} />}
        >
          <CodeEvaluatorSourceCodeBlock
            language={evaluator.language}
            sourceCode={currentVersion.sourceCode}
          />
        </Card>
      }
      aside={
        <>
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
                      <ProviderCapabilitiesHelp
                        sandboxBackend={sandboxBackend}
                      />
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
          <EvaluatorAnnotationsCard configs={outputConfigs} />
          <InputMappingCard>
            <DeclaredInputMappingList bindings={inputBindings} />
          </InputMappingCard>
        </>
      }
    />
  );
}
