import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";

import { Flex, Heading, Text } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { EditCodeDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditCodeDatasetEvaluatorSlideover";
import { CodeEvaluatorSourceCodeBlock } from "@phoenix/components/evaluators/EditCodeEvaluatorDialogContent";
import type { CodeDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/CodeDatasetEvaluatorDetails_datasetEvaluator.graphql";

const boxCSS = css`
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-static-size-200);
  margin-top: var(--global-dimension-static-size-50);
  border: 1px solid var(--global-border-color-default);
  overflow: hidden;
`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>{title}</Heading>
      <div css={boxCSS}>{children}</div>
    </Flex>
  );
}

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

  return (
    <>
      <Flex direction="column" gap="size-200">
        <Section title="Language">
          <Text>
            {evaluator.language === "PYTHON" ? "Python" : "TypeScript"}
          </Text>
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
        <Section title="Source Code">
          <CodeEvaluatorSourceCodeBlock
            language={evaluator.language}
            sourceCode={evaluator.sourceCode}
          />
        </Section>
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
