import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { EvaluatorAnnotationsCard } from "@phoenix/components/evaluators/EvaluatorAnnotationsCard";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import type { AnnotationConfigurationCard_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/AnnotationConfigurationCard_projectEvaluator.graphql";

/**
 * The annotations a project evaluator writes: their names, which direction is
 * good, the values they can emit, and (for LLM evaluators) whether the
 * evaluator explains itself.
 *
 * Split from the rest of the evaluator configuration because it is a peer of
 * Scope -- scope selects the work, this describes the result -- and the two
 * stack in the overview's aside.
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
          kind
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
          }
        }
      }
    `,
    projectEvaluatorRef
  );
  const { evaluator } = projectEvaluator;
  // An LLM evaluator whose prompt has no explanation tool does not explain
  // itself; code evaluators have no explanation toggle, so the cell is omitted.
  const includeExplanation =
    evaluator.kind === "LLM"
      ? inferIncludeExplanationFromPrompt(evaluator.promptVersion?.tools)
      : undefined;

  return (
    <EvaluatorAnnotationsCard
      outputConfigs={evaluator.outputConfigs}
      singularTitle="Annotation Configuration"
      pluralTitle="Annotation Configurations"
      includeExplanation={includeExplanation}
    />
  );
}
