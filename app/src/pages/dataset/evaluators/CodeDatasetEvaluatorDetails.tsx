import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";

import { Flex, Heading, Text } from "@phoenix/components";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import { EditCodeDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditCodeDatasetEvaluatorSlideover";
import { SandboxMismatchBanner } from "@phoenix/components/evaluators/SandboxMismatchBanner";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import type { CodeDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/CodeDatasetEvaluatorDetails_datasetEvaluator.graphql";
import { isProgrammingLanguage } from "@phoenix/types/code";

import { OutputConfigsSection, Section } from "./EvaluatorDetailShared";
import type { OutputConfig } from "./EvaluatorDetailShared";

export function CodeDatasetEvaluatorDetails({
  datasetEvaluatorRef,
  datasetId,
  isEditSlideoverOpen,
  onEditSlideoverOpenChange,
}: {
  datasetEvaluatorRef: CodeDatasetEvaluatorDetails_datasetEvaluator$key;
  datasetId: string;
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
        evaluator {
          kind
          ... on CodeEvaluator {
            sourceCode
            language
            sandboxBackendType
            environmentMismatch
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
    throw new Error(
      "CodeDatasetEvaluatorDetails called for non-CODE evaluator"
    );
  }

  const isSandboxEnabled = useFeatureFlag("sandboxing");
  const environmentMismatch = evaluator.environmentMismatch ?? false;
  const inputMapping = datasetEvaluator.inputMapping;
  const outputConfigs = (evaluator.outputConfigs ??
    []) as readonly OutputConfig[];

  // Map DB language string (e.g. "PYTHON") to ProgrammingLanguage (e.g. "Python")
  const rawLanguage = evaluator.language;
  const capitalizedLanguage = rawLanguage
    ? rawLanguage.charAt(0).toUpperCase() + rawLanguage.slice(1).toLowerCase()
    : null;
  const language =
    capitalizedLanguage && isProgrammingLanguage(capitalizedLanguage)
      ? capitalizedLanguage
      : null;

  return (
    <>
      <Flex direction="column" gap="size-300">
        {isSandboxEnabled && environmentMismatch ? (
          <SandboxMismatchBanner />
        ) : null}
        <OutputConfigsSection configs={outputConfigs} />
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Source Code</Heading>
          {rawLanguage && (
            <Text size="S" color="text-700">
              Language: {rawLanguage}
            </Text>
          )}
          {isSandboxEnabled && evaluator.sandboxBackendType != null && (
            <Text size="S" color="text-700">
              Execution Backend: {evaluator.sandboxBackendType}
            </Text>
          )}
          {evaluator.sourceCode != null &&
            (language != null ? (
              <CodeBlock language={language} value={evaluator.sourceCode} />
            ) : (
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: "var(--global-font-size-sm)",
                }}
              >
                {evaluator.sourceCode}
              </pre>
            ))}
        </Flex>
        <CodeEvaluatorInputMapping inputMapping={inputMapping} />
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

function CodeEvaluatorInputMapping({
  inputMapping,
}: {
  inputMapping: {
    literalMapping?: Record<string, boolean | string | number> | null;
    pathMapping?: Record<string, string> | null;
  } | null;
}) {
  const literalMapping = inputMapping?.literalMapping;
  const pathMapping = inputMapping?.pathMapping;

  const hasLiteralMapping =
    literalMapping && Object.keys(literalMapping).length > 0;
  const hasPathMapping = pathMapping && Object.keys(pathMapping).length > 0;

  if (!hasLiteralMapping && !hasPathMapping) {
    return null;
  }

  return (
    <Section title="Input Mapping">
      <Flex direction="column" gap="size-100">
        {pathMapping &&
          Object.entries(pathMapping).map(([key, value]) => (
            <Text key={key} size="S">
              <Text weight="heavy">{key}:</Text> {value || "Not mapped"}
            </Text>
          ))}
        {literalMapping &&
          Object.entries(literalMapping).map(([key, value]) => (
            <Text key={key} size="S">
              <Text weight="heavy">{key}:</Text>{" "}
              {typeof value === "boolean"
                ? value
                  ? "Yes"
                  : "No"
                : String(value)}
            </Text>
          ))}
      </Flex>
    </Section>
  );
}
