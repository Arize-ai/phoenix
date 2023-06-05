import React, { Key, useCallback } from "react";
import { graphql, useFragment } from "react-relay";

import { Item, Picker } from "@arizeai/components";

import { usePointCloudContext } from "@phoenix/contexts";
import { DriftMetric } from "@phoenix/store";

export function MetricSelector({ model }: { model: any }) {
  const data = useFragment(
    graphql`
      fragment MetricSelector_dimensions on Model {
        dimensions {
          name
        }
      }
    `,
    model
  );
  const metric = usePointCloudContext((state) => state.metric);
  const setMetric = usePointCloudContext((state) => state.setMetric);
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
      <Item key={"euclideanDistance"}>Euclidean Distance</Item>
    </Picker>
  );
}
