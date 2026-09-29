import { graphql, readInlineData, useFragment } from "react-relay";

import { getProjectEvaluatorResultAnnotations } from "@phoenix/hooks/useProjectEvaluatorResultAnnotations";

import type { ProjectAnnotationConfigsByNameFragment$key } from "./__generated__/ProjectAnnotationConfigsByNameFragment.graphql";
import type { useProjectAnnotationConfigsByName_config$key } from "./__generated__/useProjectAnnotationConfigsByName_config.graphql";
import {
  type AnnotationOptimizationConfig,
  toAnnotationOptimizationConfig,
} from "./optimizationUtils";

const annotationConfigFragment = graphql`
  fragment useProjectAnnotationConfigsByName_config on AnnotationConfigBase
  @inline {
    name
    annotationType
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
`;

export function useProjectAnnotationConfigsByName(
  project: ProjectAnnotationConfigsByNameFragment$key | null | undefined
): ReadonlyMap<string, AnnotationOptimizationConfig> {
  const data = useFragment(
    graphql`
      fragment ProjectAnnotationConfigsByNameFragment on Project
      @argumentDefinitions(
        annotationConfigNames: { type: "[String!]" }
        first: { type: "Int", defaultValue: 100 }
      ) {
        evaluators(
          first: $first
          filter: { annotationNames: $annotationConfigNames }
        ) {
          edges {
            node {
              name
              evaluator {
                outputConfigs {
                  ...useProjectAnnotationConfigsByName_config
                }
              }
            }
          }
        }
        annotationConfigs(first: $first, names: $annotationConfigNames) {
          edges {
            config: node {
              ...useProjectAnnotationConfigsByName_config
            }
          }
        }
      }
    `,
    project
  );
  const configsByName = new Map<string, AnnotationOptimizationConfig>();
  data?.evaluators.edges.forEach(({ node: { name, evaluator } }) => {
    for (const result of getProjectEvaluatorResultAnnotations({
      name,
      outputConfigs: evaluator.outputConfigs.map((config) =>
        readInlineData<useProjectAnnotationConfigsByName_config$key>(
          annotationConfigFragment,
          config
        )
      ),
    })) {
      if (result.config != null) {
        configsByName.set(result.name, result.config);
      }
    }
  });
  // Explicit project configs take precedence over evaluator-derived defaults.
  data?.annotationConfigs.edges.forEach(({ config: configRef }) => {
    const config = readInlineData<useProjectAnnotationConfigsByName_config$key>(
      annotationConfigFragment,
      configRef
    );
    if (config.name == null) {
      return;
    }
    const optimizationConfig = toAnnotationOptimizationConfig(config);
    if (optimizationConfig == null) {
      return;
    }
    configsByName.set(config.name, optimizationConfig);
  });
  return configsByName;
}
