import React, { Key, useCallback } from "react";
import { graphql, useFragment } from "react-relay";

import { Item, Picker, Section } from "@arizeai/components";

import { usePointCloudContext } from "@phoenix/contexts";
import { DriftMetric, MetricDefinition } from "@phoenix/store";
import { assertUnreachable } from "@phoenix/typeUtils";

import { MetricSelector_dimensions$key } from "./__generated__/MetricSelector_dimensions.graphql";

function getMetricKey(metric: MetricDefinition) {
  const { type, metric: metricName } = metric;
  switch (type) {
    case "drift":
      return metricName;
    case "dataQuality": {
      const { dimensionName } = metric;
      return `${dimensionName} avg`;
    }
    default:
      assertUnreachable(type);
  }
}
export function MetricSelector({
  model,
}: {
  model: MetricSelector_dimensions$key;
}) {
  const data = useFragment<MetricSelector_dimensions$key>(
    graphql`
      fragment MetricSelector_dimensions on Model {
        numericDimensions: dimensions(include: { dataTypes: [numeric] }) {
          edges {
            node {
              name
              type
            }
          }
        }
      }
    `,
    model
  );
  const metric = usePointCloudContext((state) => state.metric);
  const setMetric = usePointCloudContext((state) => state.setMetric);
  const numericDimensionNames = data.numericDimensions.edges.map(
    (edge) => edge.node.name
  );
  const onSelectionChange = useCallback(
    (key: Key) => {
      if (numericDimensionNames.includes(key as string)) {
        setMetric({
          type: "dataQuality",
          metric: "average",
          dimensionName: key as string,
        });
      } else {
        setMetric({
          type: "drift",
          metric: key as DriftMetric["metric"],
        });
      }
    },
    [setMetric, numericDimensionNames]
  );
  return (
    <Picker
      label="metric"
      selectedKey={getMetricKey(metric)}
      onSelectionChange={onSelectionChange}
      placeholder="Select a metric"
    >
      <Section title="Drift">
        <Item key={"euclideanDistance"}>Euclidean Distance</Item>
      </Section>
      <Section title="Data Quality">
        {numericDimensionNames.map((dimensionName) => {
          return (
            <Item key={`${dimensionName} avg`}>{`${dimensionName} avg`}</Item>
          );
        })}
      </Section>
    </Picker>
  );
}
