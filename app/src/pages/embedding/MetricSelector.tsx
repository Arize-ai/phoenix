import React, { Key, useCallback, useTransition } from "react";
import { graphql, useFragment } from "react-relay";

import {
  CollectionElement,
  Content,
  ContextualHelp,
  Heading,
  Item,
  Picker,
  Section,
} from "@arizeai/components";

import { useDatasets, usePointCloudContext } from "@phoenix/contexts";
import {
  DriftMetricDefinition,
  MetricDefinition,
  PerformanceMetricDefinition,
  RetrievalMetricDefinition,
} from "@phoenix/store";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  MetricSelector_dimensions$data,
  MetricSelector_dimensions$key,
} from "./__generated__/MetricSelector_dimensions.graphql";

/**
 * Delineates the tuple (or triple) of metric type and metric name
 */
const METRIC_KEY_SEPARATOR = ":";
/**
 * Type guard for MetricDefinition["type"]
 */
function isMetricType(
  maybeType: unknown
): maybeType is MetricDefinition["type"] {
  return ["drift", "performance", "dataQuality", "retrieval"].includes(
    maybeType as string
  );
}
/**
 * A function that flattens the metrics into a single key
 * E.x. "dataQuality:average:age"
 * @param {MetricDefinition} metric
 * @returns
 */
function getMetricKey(metric: MetricDefinition) {
  const { type, metric: metricName } = metric;
  switch (type) {
    case "drift":
      return `${type}${METRIC_KEY_SEPARATOR}${metricName}`;
    case "retrieval":
      return `${type}${METRIC_KEY_SEPARATOR}${metricName}`;
    case "performance":
      return `${type}${METRIC_KEY_SEPARATOR}${metricName}`;
    case "dataQuality": {
      const { name } = metric.dimension;
      return `${type}${METRIC_KEY_SEPARATOR}${metricName}${METRIC_KEY_SEPARATOR}${name}`;
    }
    default:
      assertUnreachable(type);
  }
}

type ParseMetricKeyParams = {
  metricKey: string;
  dimensions: MetricSelector_dimensions$data["numericDimensions"]["edges"][number]["node"][];
};
/**
 * Parses a metric key into a MetricDefinition
 * @param {string} metricKey
 * @returns {MetricDefinition} definition
 */
function parseMetricKey({
  metricKey,
  dimensions,
}: ParseMetricKeyParams): MetricDefinition {
  const [type, metricName, dimensionName] =
    metricKey.split(METRIC_KEY_SEPARATOR);
  if (!isMetricType(type)) {
    throw new Error(`Invalid metric type: ${type}`);
  }
  switch (type) {
    case "drift":
      return { type, metric: metricName as DriftMetricDefinition["metric"] };
    case "retrieval":
      return {
        type,
        metric: metricName as RetrievalMetricDefinition["metric"],
      };
    case "performance":
      return {
        type,
        metric: metricName as PerformanceMetricDefinition["metric"],
      };
    case "dataQuality": {
      const dimension = dimensions.find((d) => d.name === dimensionName);
      if (!dimension) {
        throw new Error(`Invalid dimension name: ${dimensionName}`);
      }
      return {
        type,
        metric: metricName as "average",
        dimension,
      };
    }
    default:
      assertUnreachable(type);
  }
}

const contextualHelp = (
  <ContextualHelp variant="info">
    <Heading level={4}>Analysis Metric</Heading>
    <Content>
      <p>Select a metric to drive the analysis of your embeddings.</p>
      <p>
        To analyze the the drift between your two datasets, select a drift
        metric and the UI will highlight areas of high drift.
      </p>
      <p>
        To analyze the quality of your embeddings, select a dimension data
        quality metric by which to analyze the point cloud. The UI will
        highlight areas where the data quality is degrading.
      </p>
    </Content>
  </ContextualHelp>
);
export function MetricSelector({
  model,
}: {
  model: MetricSelector_dimensions$key;
}) {
  const [, startTransition] = useTransition();
  const data = useFragment<MetricSelector_dimensions$key>(
    graphql`
      fragment MetricSelector_dimensions on Model {
        numericDimensions: dimensions(include: { dataTypes: [numeric] }) {
          edges {
            node {
              id
              name
              type
            }
          }
        }
      }
    `,
    model
  );
  const { referenceDataset, corpusDataset } = useDatasets();
  const hasReferenceDataset = !!referenceDataset;
  const hasCorpusDataset = !!corpusDataset;
  const metric = usePointCloudContext((state) => state.metric);
  const loading = usePointCloudContext((state) => state.loading);
  const setMetric = usePointCloudContext((state) => state.setMetric);
  const numericDimensions = data.numericDimensions.edges.map(
    (edge) => edge.node
  );
  const hasNumericDimensions = numericDimensions.length > 0;
  const onSelectionChange = useCallback(
    (key: Key) => {
      const metricDefinition = parseMetricKey({
        metricKey: key as string,
        dimensions: numericDimensions,
      });
      startTransition(() => {
        setMetric(metricDefinition);
      });
    },
    [setMetric, numericDimensions, startTransition]
  );
  return (
    <Picker
      label="metric"
      labelExtra={contextualHelp}
      selectedKey={metric ? getMetricKey(metric) : undefined}
      onSelectionChange={onSelectionChange}
      placeholder="Select a metric..."
      isDisabled={loading}
    >
      {hasReferenceDataset ? (
        <Section title="Drift">
          <Item
            key={getMetricKey({
              type: "drift",
              metric: "euclideanDistance",
            })}
          >
            Euclidean Distance
          </Item>
        </Section>
      ) : (
        (null as unknown as CollectionElement<unknown>)
      )}
      {hasCorpusDataset ? (
        <Section title="Retrieval">
          <Item
            key={getMetricKey({
              type: "retrieval",
              metric: "queryDistance",
            })}
          >
            Query Distance
          </Item>
        </Section>
      ) : (
        (null as unknown as CollectionElement<unknown>)
      )}
      {hasReferenceDataset ? (
        <Section title="Drift">
          <Item
            key={getMetricKey({
              type: "drift",
              metric: "euclideanDistance",
            })}
          >
            Euclidean Distance
          </Item>
        </Section>
      ) : (
        (null as unknown as CollectionElement<unknown>)
      )}
      <Section title="Performance">
        <Item
          key={getMetricKey({
            type: "performance",
            metric: "accuracyScore",
          })}
        >
          Accuracy Score
        </Item>
      </Section>
      {hasNumericDimensions ? (
        <Section title="Data Quality">
          {numericDimensions.map((dimension) => {
            return (
              <Item
                key={getMetricKey({
                  type: "dataQuality",
                  metric: "average",
                  dimension,
                })}
              >{`${dimension.name} avg`}</Item>
            );
          })}
        </Section>
      ) : (
        (null as unknown as CollectionElement<unknown>)
      )}
    </Picker>
  );
}
