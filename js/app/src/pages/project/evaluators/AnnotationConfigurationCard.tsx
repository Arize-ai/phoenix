import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Card, View } from "@phoenix/components";
import { OutputConfigBlock } from "@phoenix/components/evaluators/OutputConfigBlock";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import type { AnnotationConfigurationCard_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/AnnotationConfigurationCard_projectEvaluator.graphql";

/**
 * The annotation an LLM project evaluator writes: its name, which direction is
 * good, the values it can emit, and whether it explains itself.
 *
 * Split from the rest of the LLM configuration because it is a peer of Scope --
 * scope selects the work, this describes the result -- and the two stack in
 * the overview's aside. The grid inside matches the dataset evaluator pages,
 * so an annotation reads the same wherever it appears.
 */
export function AnnotationConfigurationCard({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: AnnotationConfigurationCard_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment AnnotationConfigurationCard_projectEvaluator on ProjectEvaluator {
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
                threshold
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
    <Card title="Annotation Configuration">
      <View padding="size-200">
        <OutputConfigBlock
          config={outputConfig}
          typename={outputConfig.__typename}
          includeExplanation={includeExplanation}
        />
      </View>
    </Card>
  );
}
