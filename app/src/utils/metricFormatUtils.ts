type MetricFormattingDefinition = {
  name: string;
  shortName: string;
  definition?: string;
};

const METRIC_DEFINITIONS: Record<
  string,
  MetricFormattingDefinition | undefined
> = {
  euclideanDistance: {
    name: "Euclidean Distance",
    shortName: "Euc. Distance",
    definition: `Euclidean distance over time captures how much your primary dataset's embeddings are drifting from the reference data. Euclidean distance of the embeddings is calculated by taking the centroid of the embedding vectors for each dataset and calculating the distance between the two centroids.`,
  },
  accuracyScore: {
    name: "Accuracy Score",
    shortName: "Accuracy",
    definition: `Accuracy classification score. In multi-label classification, this function computes subset accuracy: the set of labels predicted for a sample must exactly match the corresponding set of labels in the ground truth.`,
  },
} as const;

export function getMetricNameByMetricKey(metricKey: string): string {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (definition != null) {
    return definition.name;
  }
  return metricKey;
}

export function getMetricShortNameByMetricKey(metricKey: string): string {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (definition != null) {
    return definition.shortName;
  }
  return metricKey;
}

export function getMetricDescriptionByMetricKey(
  metricKey: string
): string | null {
  const definition = METRIC_DEFINITIONS[metricKey];
  if (definition && definition.definition != null) {
    return definition.definition || null;
  }
  return null;
}
