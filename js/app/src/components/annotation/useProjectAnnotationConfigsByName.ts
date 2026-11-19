import { graphql, useFragment } from "react-relay";

import type { ProjectAnnotationConfigsByNameFragment$key } from "./__generated__/ProjectAnnotationConfigsByNameFragment.graphql";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";

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
        # Aliased: Relay rejects the same field with different arguments on
        # one parent, and config mutations also select the unfiltered list
        configsByName: annotationConfigs(
          first: $first
          names: $annotationConfigNames
        ) {
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
  data?.configsByName.edges.forEach(({ config }) => {
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
