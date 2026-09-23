import { graphql, useLazyLoadQuery } from "react-relay";

import type { useExperimentAnnotationMetricNamesQuery } from "./__generated__/useExperimentAnnotationMetricNamesQuery.graphql";

const experimentAnnotationMetricNamesQuery = graphql`
  query useExperimentAnnotationMetricNamesQuery($id: ID!) {
    dataset: node(id: $id) {
      ... on Dataset {
        experimentAnnotationSummaries {
          annotationName
        }
      }
    }
  }
`;

export function useExperimentAnnotationMetricNames(
  datasetId: string
): ReadonlyArray<string> {
  // Annotation discovery intentionally omits per-experiment aggregates so
  // opening the chart selector does not fetch every chart's metrics.
  const data = useLazyLoadQuery<useExperimentAnnotationMetricNamesQuery>(
    experimentAnnotationMetricNamesQuery,
    { id: datasetId },
    { fetchPolicy: "store-or-network" }
  );
  return (data.dataset.experimentAnnotationSummaries ?? []).map(
    ({ annotationName }) => annotationName
  );
}
