import React, { Key, useCallback } from "react";
import { graphql, useFragment } from "react-relay";

import { CollectionElement, Item, Picker, Section } from "@arizeai/components";

import { usePointCloudContext } from "@phoenix/contexts";
import { DriftMetric } from "@phoenix/store";

import { MetricSelector_dimensions$key } from "./__generated__/MetricSelector_dimensions.graphql";

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
      setMetric({
        type: "drift",
        metric: key as DriftMetric["metric"],
      });
    },
    [setMetric]
  );
  return (
    <Picker
      label="metric"
      selectedKey={metric.metric}
      onSelectionChange={onSelectionChange}
    >
      <Section title="Drift Metrics">
        <Item key={"euclideanDistance"}>Euclidean Distance</Item>
      </Section>
      <Section title="Data Quality Metrics">
        {numericDimensionNames.map((dimensionName) => {
          return <Item key={dimensionName}>{dimensionName}</Item>;
        })}
      </Section>
    </Picker>
  );
}
