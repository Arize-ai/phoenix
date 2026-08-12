import { graphql, useFragment } from "react-relay";

import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation";

import type { ProjectAnnotationMetricsConfigFragment$key } from "./__generated__/ProjectAnnotationMetricsConfigFragment.graphql";

export function useProjectAnnotationConfigsByName(
  project: ProjectAnnotationMetricsConfigFragment$key | null | undefined
): ReadonlyMap<string, AnnotationOptimizationConfig> {
  const data = useFragment(
    graphql`
      fragment ProjectAnnotationMetricsConfigFragment on Project
      @argumentDefinitions(
        annotationConfigNames: { type: "[String!]" }
        first: { type: "Int", defaultValue: 100 }
      ) {
        annotationConfigs(first: $first, names: $annotationConfigNames) {
          edges {
            config: node {
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
      }
    `,
    project
  );
  const configsByName = new Map<string, AnnotationOptimizationConfig>();
  data?.annotationConfigs.edges.forEach(({ config }) => {
    if (config.name == null || config.annotationType == null) {
      return;
    }
    configsByName.set(config.name, {
      annotationType: config.annotationType,
      optimizationDirection: config.optimizationDirection,
      lowerBound: config.lowerBound,
      upperBound: config.upperBound,
      threshold: config.threshold,
      values: config.values,
    });
  });
  return configsByName;
}
