import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";

import { Flex, Heading, List, ListItem, Text, View } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { EditCodeDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditCodeDatasetEvaluatorSlideover";
import { CodeEvaluatorSourceCodeBlock } from "@phoenix/components/evaluators/CodeEvaluatorSourceCodeBlock";
import type { CodeDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/CodeDatasetEvaluatorDetails_datasetEvaluator.graphql";
import type { datasetEvaluatorDetailsLoaderQuery } from "@phoenix/pages/dataset/evaluators/__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";
import {
  getBackendDescription,
  languageLabel,
  summarizeConfig,
} from "@phoenix/pages/settings/sandboxes/utils";

type SandboxBackendInfo =
  datasetEvaluatorDetailsLoaderQuery["response"]["sandboxBackends"][number];

const splitLayoutCSS = css`
  display: grid;
  gap: var(--global-dimension-size-200);
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>{title}</Heading>
      <View
        padding="size-200"
        borderWidth="thin"
        borderColor="default"
        borderRadius="medium"
      >
        <Flex direction="column" gap="size-150">
          {children}
        </Flex>
      </View>
    </Flex>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Flex direction="column" gap="size-25">
      <Text weight="heavy" size="S">
        {label}
      </Text>
      {typeof value === "string" ? <Text>{value}</Text> : value}
    </Flex>
  );
}

function DetailListItem({ label, value }: { label: string; value: string }) {
  return (
    <ListItem>
      <View paddingStart="size-100" paddingEnd="size-100">
        <Flex direction="row" justifyContent="space-between">
          <Text size="XS" color="text-700">
            {label}
          </Text>
          <Text size="XS">{value}</Text>
        </Flex>
      </View>
    </ListItem>
  );
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
      : evaluator.outputConfigs;
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

  return (
    <>
      <div css={splitLayoutCSS}>
        <Flex direction="column" gap="size-200" flex="2 1 0" minWidth={0}>
          <Section title="Source Code">
            <CodeEvaluatorSourceCodeBlock
              language={evaluator.language}
              sourceCode={evaluator.sourceCode}
            />
          </Section>
          <Section title="Input Mapping">
            <Flex direction="column" gap="size-100">
              <Text weight="heavy" size="S">
                Path mapping
              </Text>
              <JSONBlock
                value={JSON.stringify(
                  datasetEvaluator.inputMapping.pathMapping,
                  null,
                  2
                )}
              />
              <Text weight="heavy" size="S">
                Literal mapping
              </Text>
              <JSONBlock
                value={JSON.stringify(
                  datasetEvaluator.inputMapping.literalMapping,
                  null,
                  2
                )}
              />
            </Flex>
          </Section>
          <Section title="Evaluator Annotation">
            <JSONBlock value={JSON.stringify(outputConfigs, null, 2)} />
          </Section>
        </Flex>
        <Flex direction="column" gap="size-200" flex="1 1 0" minWidth={0}>
          <Section title="Language">
            <Text>
              {evaluator.language === "PYTHON" ? "Python" : "TypeScript"}
            </Text>
          </Section>
          <Section title="Sandbox">
            {sandboxConfig == null ? (
              <Text color="text-700">No sandbox configuration selected.</Text>
            ) : (
              <Flex direction="column" gap="size-150">
                <DetailRow label="Config" value={sandboxConfig.name} />
                {sandboxConfig.description ? (
                  <DetailRow
                    label="Description"
                    value={sandboxConfig.description}
                  />
                ) : null}
                <DetailRow
                  label="Provider"
                  value={
                    sandboxBackend?.displayName ??
                    sandboxConfig.provider.backendType
                  }
                />
                <DetailRow
                  label="Runtime"
                  value={getBackendDescription(
                    sandboxConfig.provider.backendType
                  )}
                />
                <DetailRow
                  label="Language"
                  value={languageLabel(sandboxConfig.provider.language)}
                />
                <DetailRow
                  label="Timeout"
                  value={`${sandboxConfig.timeout} seconds`}
                />
                <Flex direction="column" gap="size-50">
                  <Text weight="heavy" size="S">
                    Capabilities
                  </Text>
                  <List size="S">
                    <DetailListItem
                      label="env_vars"
                      value={
                        sandboxBackend?.supportsEnvVars
                          ? "supported"
                          : "not supported"
                      }
                    />
                    <DetailListItem
                      label="internet_access"
                      value={getInternetAccessLabel(
                        sandboxBackend?.internetAccess ?? "NONE"
                      )}
                    />
                    <DetailListItem
                      label="dependencies"
                      value={getDependenciesLabel(
                        sandboxBackend?.dependenciesLanguage ?? null
                      )}
                    />
                  </List>
                </Flex>
                <Flex direction="column" gap="size-50">
                  <Text weight="heavy" size="S">
                    Custom Settings
                  </Text>
                  {summarizeConfig(sandboxConfig.config) ===
                  "No custom settings" ? (
                    <Text color="text-700">No custom settings</Text>
                  ) : (
                    <JSONBlock
                      value={JSON.stringify(sandboxConfig.config, null, 2)}
                    />
                  )}
                </Flex>
              </Flex>
            )}
          </Section>
        </Flex>
      </div>
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
