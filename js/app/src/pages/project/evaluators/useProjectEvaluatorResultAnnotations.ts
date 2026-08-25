import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  type AnnotationOptimizationConfig,
  toAnnotationOptimizationConfig,
} from "@phoenix/components/annotation";

import type { useProjectEvaluatorResultAnnotationsFragment$key } from "./__generated__/useProjectEvaluatorResultAnnotationsFragment.graphql";

/** One annotation an evaluator's runs write, with its optimization metadata. */
export type ProjectEvaluatorResultAnnotation = {
  /** The name the persisted annotations carry. */
  name: string;
  /**
   * The output config behind the annotation, narrowed to its optimization
   * metadata; undefined when the config carries none.
   */
  config: AnnotationOptimizationConfig | undefined;
};

/**
 * The annotations this evaluator writes, named the way its runs persist them.
 *
 * Mirrors the server's naming contract (`BaseEvaluator.evaluate` in
 * `src/phoenix/server/api/evaluators.py`, enforced by the online-eval
 * executor): a lone output config writes one annotation named after the
 * project evaluator; multiple output configs write one annotation per config,
 * named `"{projectEvaluatorName}.{configName}"`.
 *
 * Project evaluators have no entry in the evaluated project's
 * `annotationConfigs`; their labels, scores, and optimization direction live on
 * the evaluator itself. Charts of evaluator results read that metadata here
 * rather than from the project, the way charts of human annotations do.
 */
export function useProjectEvaluatorResultAnnotations(
  projectEvaluator: useProjectEvaluatorResultAnnotationsFragment$key
): ReadonlyArray<ProjectEvaluatorResultAnnotation> {
  const data = useFragment(
    graphql`
      fragment useProjectEvaluatorResultAnnotationsFragment on ProjectEvaluator {
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
  // array each render would defeat the memo and refetch their charts. Relay
  // data is stable while the store is, so these deps track the evaluator.
  return useMemo(() => {
    const { outputConfigs } = evaluator;
    if (outputConfigs.length > 1) {
      // Multi-output: one annotation per config, dotted with the config name.
      return outputConfigs.flatMap((outputConfig) =>
        outputConfig.name == null
          ? []
          : [
              {
                name: `${name}.${outputConfig.name}`,
                config: toAnnotationOptimizationConfig(outputConfig),
              },
            ]
      );
    }
    // A lone output (or none declared) writes under the evaluator's own name,
    // whatever the config itself is called.
    const outputConfig = outputConfigs[0];
    return [
      {
        name,
        config: outputConfig
          ? toAnnotationOptimizationConfig(outputConfig)
          : undefined,
      },
    ];
  }, [evaluator, name]);
}
