import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Card, Flex, Text, View } from "@phoenix/components";
import { Token } from "@phoenix/components/core/token";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import {
  EvaluatorDetailList,
  EvaluatorDetailRow,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import type {
  LLMProjectEvaluatorAnnotation_projectEvaluator$data,
  LLMProjectEvaluatorAnnotation_projectEvaluator$key,
} from "@phoenix/pages/project/evaluators/__generated__/LLMProjectEvaluatorAnnotation_projectEvaluator.graphql";

/**
 * The annotation an LLM project evaluator writes: its name, which direction is
 * good, the values it can emit, and whether it explains itself.
 *
 * Split from the rest of the LLM configuration because it is a peer of Scope --
 * scope selects the work, this describes the result -- and the two read side by
 * side on the overview.
 */
export function LLMProjectEvaluatorAnnotation({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: LLMProjectEvaluatorAnnotation_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment LLMProjectEvaluatorAnnotation_projectEvaluator on ProjectEvaluator {
        evaluator {
          ... on LLMEvaluator {
            promptVersion {
              tools {
                tools {
                  __typename
                  ... on PromptToolFunction {
                    function {
                      parameters
                    }
                  }
                }
              }
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
              }
            }
          }
        }
      }
    `,
    projectEvaluatorRef
  );
  const { evaluator } = projectEvaluator;
  const outputConfig = evaluator.outputConfigs?.[0];
  // An evaluator whose prompt has no explanation tool does not explain itself.
  const includeExplanation = inferIncludeExplanationFromPrompt(
    evaluator.promptVersion?.tools
  );

  if (outputConfig == null || outputConfig.__typename === "%other") {
    return null;
  }

  return (
    <Card title="Annotation">
      <View padding="size-200">
        <EvaluatorDetailList>
          <EvaluatorDetailRow label="Name">
            <Truncate title={outputConfig.name}>
              <Text size="S">{outputConfig.name}</Text>
            </Truncate>
          </EvaluatorDetailRow>
          {outputConfig.optimizationDirection && (
            <EvaluatorDetailRow label="Optimization">
              <Text size="S">{outputConfig.optimizationDirection}</Text>
            </EvaluatorDetailRow>
          )}
          {outputConfig.__typename === "CategoricalAnnotationConfig" &&
            outputConfig.values.length > 0 && (
              <EvaluatorDetailRow label="Values">
                {/* Chips rather than prose: each label and its score is one
                    scannable unit, and a long value set wraps instead of
                    running off the row. */}
                <Flex direction="row" gap="size-50" wrap justifyContent="end">
                  {outputConfig.values.map((value) => (
                    <Token key={value.label}>
                      {value.score == null
                        ? value.label
                        : `${value.label} = ${value.score}`}
                    </Token>
                  ))}
                </Flex>
              </EvaluatorDetailRow>
            )}
          {outputConfig.__typename === "ContinuousAnnotationConfig" &&
            (outputConfig.lowerBound != null ||
              outputConfig.upperBound != null) && (
              <EvaluatorDetailRow label="Range">
                <Text size="S">{formatRange(outputConfig)}</Text>
              </EvaluatorDetailRow>
            )}
          <EvaluatorDetailRow label="Explanations">
            <Text size="S">{includeExplanation ? "Enabled" : "Disabled"}</Text>
          </EvaluatorDetailRow>
        </EvaluatorDetailList>
      </View>
    </Card>
  );
}

type ContinuousOutputConfig = Extract<
  NonNullable<
    LLMProjectEvaluatorAnnotation_projectEvaluator$data["evaluator"]["outputConfigs"]
  >[number],
  { readonly __typename: "ContinuousAnnotationConfig" }
>;

/** An unbounded end reads as infinity rather than as a missing value. */
function formatRange(outputConfig: ContinuousOutputConfig): string {
  return `${outputConfig.lowerBound ?? "-∞"} to ${outputConfig.upperBound ?? "∞"}`;
}
