type MetricDescription = {
  name: string;
  shortName: string;
  description?: string;
};

const METRIC_DESCRIPTIONS: Record<string, MetricDescription> = {
  euclideanDistance: {
    name: "Euclidean Distance",
    shortName: "Euc. Distance",
    description: `Euclidean distance over time captures how much your primary dataset's embeddings are drifting from the reference data. Euclidean distance of the embeddings is calculated by taking the centroid of the embedding vectors for each dataset and calculating the distance between the two centroids.`,
  },
} as const;

export function getMetricNameByMetricKey(metricKey: string): string {
  if (METRIC_DESCRIPTIONS[metricKey]) {
    return METRIC_DESCRIPTIONS[metricKey].name;
  }
  return metricKey;
}

export function getMetricShortNameByMetricKey(metricKey: string): string {
  if (METRIC_DESCRIPTIONS[metricKey]) {
    return METRIC_DESCRIPTIONS[metricKey].shortName;
  }
  return metricKey;
}

export function getMetricDescriptionByMetricKey(
  metricKey: string
): string | null {
  if (
    METRIC_DESCRIPTIONS[metricKey] &&
    METRIC_DESCRIPTIONS[metricKey].description != null
  ) {
    return METRIC_DESCRIPTIONS[metricKey].description || null;
  }
  return null;
}
