import React from "react";
import { timeFormat } from "d3-time-format";
import { css } from "@emotion/react";

import {
  FieldColorDesignation,
  Heading,
  Item,
  Picker,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { TimePreset, useTimeRange } from "@phoenix/contexts/TimeRangeContext";

/**
 * Formats time to be displayed in full
 */
export const fullTimeFormatter = timeFormat("%x %H:%M %p");

type PrimaryDatasetTimeRangeProps = object;

export function PrimaryDatasetTimeRange(_: PrimaryDatasetTimeRangeProps) {
  const {
    timeRange,
    timePreset: selectedTimePreset,
    setTimePreset,
  } = useTimeRange();
  return (
    <FieldColorDesignation color={"designationTurquoise"}>
      <TooltipTrigger delay={0} placement="bottom right">
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
            <Item key={TimePreset.all}>All</Item>
            <Item key={TimePreset.last_day}>Last Day</Item>
            <Item key={TimePreset.last_week}>Last Week</Item>
            <Item key={TimePreset.last_month}>Last Month</Item>
            <Item key={TimePreset.last_3_months}>Last 3 Months</Item>
            <Item key={TimePreset.first_day}>First Day</Item>
            <Item key={TimePreset.first_week}>First Week</Item>
            <Item key={TimePreset.first_month}>First Month</Item>
          </Picker>
        </TriggerWrap>
        <Tooltip>
          <section
            css={css`
              h4 {
                margin-bottom: 0.5rem;
              }
            `}
          >
            <Heading level={4}>primary dataset time range</Heading>
            <div>start: {fullTimeFormatter(timeRange.start)}</div>
            <div>end: {fullTimeFormatter(timeRange.end)}</div>
          </section>
        </Tooltip>
      </TooltipTrigger>
    </FieldColorDesignation>
  );
}
