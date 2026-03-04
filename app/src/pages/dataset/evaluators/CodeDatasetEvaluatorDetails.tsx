import { css } from "@emotion/react";
import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";

import { Flex, Heading, Text } from "@phoenix/components";
import { EditCodeDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditCodeDatasetEvaluatorSlideover";
import { ReadOnlyCategoricalConfig } from "@phoenix/components/evaluators/ReadOnlyCategoricalConfig";
import { ReadOnlyContinuousConfig } from "@phoenix/components/evaluators/ReadOnlyContinuousConfig";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import type { CodeDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/CodeDatasetEvaluatorDetails_datasetEvaluator.graphql";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";

const boxCSS = css`
  background-color: var(--global-background-color-dark);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-static-size-200);
  margin-top: var(--global-dimension-static-size-50);
  border: 1px solid var(--global-border-color-default);
  overflow: hidden;
`;

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

  const inputMapping = datasetEvaluator.inputMapping;
  const outputConfigs = evaluator.outputConfigs ?? [];

  return (
    <>
      <Flex direction="column" gap="size-300">
        {outputConfigs.length > 0 && (
          <Flex direction="column" gap="size-100">
            <Heading level={2}>
              {outputConfigs.length === 1
                ? "Evaluator Annotation"
                : `Evaluator Annotations (${outputConfigs.length})`}
            </Heading>
            {outputConfigs.map((config, idx) => {
              const isCategorical = "values" in config && config.values;
              const storeConfig: AnnotationConfig = isCategorical
                ? {
                    name: config.name ?? "",
                    optimizationDirection:
                      config.optimizationDirection ?? "NONE",
                    values: config.values!.map((v) => ({
                      label: v.label,
                      score: v.score ?? undefined,
                    })),
                  }
                : {
                    name: config.name ?? "",
                    optimizationDirection:
                      config.optimizationDirection ?? "NONE",
                    lowerBound: config.lowerBound ?? null,
                    upperBound: config.upperBound ?? null,
                  };
              return (
                <EvaluatorStoreProvider
                  key={config.name || idx}
                  initialState={
                    {
                      evaluator: { kind: "CODE" },
                      outputConfigs: [storeConfig],
                    } as Parameters<
                      typeof EvaluatorStoreProvider
                    >[0]["initialState"]
                  }
                >
                  {isCategorical ? (
                    <ReadOnlyCategoricalConfig isReadOnly />
                  ) : (
                    <ReadOnlyContinuousConfig isReadOnly />
                  )}
                </EvaluatorStoreProvider>
              );
            })}
          </Flex>
        )}
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Source Code</Heading>
          <Text size="S" color="text-700">
            Language: {evaluator.language}
          </Text>
          <div css={boxCSS}>
            <pre
              css={css`
                margin: 0;
                white-space: pre-wrap;
                word-break: break-word;
                font-size: var(--global-font-size-sm);
              `}
            >
              {evaluator.sourceCode}
            </pre>
          </div>
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
    <Flex direction="column" gap="size-100">
      <Heading level={2}>Input Mapping</Heading>
      <div css={boxCSS}>
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
      </div>
    </Flex>
  );
}
