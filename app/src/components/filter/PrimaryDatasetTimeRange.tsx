import {
  FieldColorDesignation,
  Item,
  Picker,
  TooltipTrigger,
  Tooltip,
  TriggerWrap,
} from "@arizeai/components";
import React from "react";
import { TimePreset, useTimeRange } from "@phoenix/contexts/TimeRangeContext";

type PrimaryDatasetTimeRangeProps = object;

export function PrimaryDatasetTimeRange(_: PrimaryDatasetTimeRangeProps) {
  const { timePreset: selectedTimePreset, setTimePreset } = useTimeRange();
  return (
    <FieldColorDesignation color={"designationTurquoise"}>
      <TooltipTrigger>
        <TriggerWrap>
          <Picker
            defaultSelectedKey={selectedTimePreset}
            data-testid="dataset-time-range"
            aria-label={`Time range for the primary dataset`}
            addonBefore={"primary"}
            onSelectionChange={(key) => {
              if (key !== selectedTimePreset) {
                setTimePreset(key as TimePreset);
              }
            }}
          >
            <Item key={TimePreset.last_day}>Last Day</Item>
            <Item key={TimePreset.last_week}>Last Week</Item>
            <Item key={TimePreset.last_month}>Last Month</Item>
          </Picker>
        </TriggerWrap>
        <Tooltip>The time range within the primary dataset to display</Tooltip>
      </TooltipTrigger>
    </FieldColorDesignation>
  );
}
