import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  type AnnotationOptimizationConfig,
  toAnnotationOptimizationConfig,
} from "@phoenix/components/annotation";

import type { useProjectEvaluatorOutputConfigFragment$key } from "./__generated__/useProjectEvaluatorOutputConfigFragment.graphql";

/**
 * The output config for the annotation this evaluator writes.
 *
 * Project evaluators have no entry in the evaluated project's
 * `annotationConfigs`; their labels, scores, and optimization direction live on
 * the evaluator itself. Charts of evaluator results read that metadata here
 * rather than from the project, the way charts of human annotations do.
 */
export function useProjectEvaluatorOutputConfig(
  projectEvaluator: useProjectEvaluatorOutputConfigFragment$key
): AnnotationOptimizationConfig | undefined {
  const data = useFragment(
    graphql`
      fragment useProjectEvaluatorOutputConfigFragment on ProjectEvaluator {
        name
        evaluator {
          outputConfigs {
            ... on AnnotationConfigBase {
              name
              annotationType
            }
            ... on CategoricalAnnotationConfig {
              optimizationDirection
              values {
                label
                score
              }
            }
            ... on ContinuousAnnotationConfig {
              optimizationDirection
              lowerBound
              upperBound
            }
            ... on FreeformAnnotationConfig {
              optimizationDirection
              threshold
              lowerBound
              upperBound
            }
          }
        }
      }
    `,
    projectEvaluator
  );
  const { name, evaluator } = data;
  // Memoized because callers pass this into memoized subtrees, where a new
  // object each render would defeat the memo and refetch their charts. Relay
  // data is stable while the store is, so these deps track the evaluator.
  return useMemo(() => {
    // An evaluator can declare several outputs, and the charted annotation
    // carries the project evaluator's name -- so match on that, falling back to
    // a lone output whose name happens to differ.
    const { outputConfigs } = evaluator;
    const config =
      outputConfigs.find((outputConfig) => outputConfig.name === name) ??
      (outputConfigs.length === 1 ? outputConfigs[0] : undefined);
    return config ? toAnnotationOptimizationConfig(config) : undefined;
  }, [evaluator, name]);
}
