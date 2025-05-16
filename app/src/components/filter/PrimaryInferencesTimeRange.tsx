import { css } from "@emotion/react";

import {
  FieldColorDesignation,
  Item,
  Picker,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Heading } from "@phoenix/components";
import { useInferences } from "@phoenix/contexts";
import { TimePreset, useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

type PrimaryInferencesTimeRangeProps = object;

export function PrimaryInferencesTimeRange(_: PrimaryInferencesTimeRangeProps) {
  const {
    timeRange,
    timePreset: selectedTimePreset,
    setTimePreset,
  } = useTimeRange();
  const {
    primaryInferences: { name },
  } = useInferences();
  const nameAbbr = name.slice(0, 10);
  return (
    <FieldColorDesignation color={"designationTurquoise"}>
      <TooltipTrigger delay={0} placement="bottom right">
        <TriggerWrap>
          <Picker
            label="primary inferences"
            defaultSelectedKey={selectedTimePreset}
            data-testid="inferences-time-range"
            aria-label={`Time range for the primary inferences`}
            addonBefore={nameAbbr}
            onSelectionChange={(key) => {
              if (key !== selectedTimePreset) {
                setTimePreset(key as TimePreset);
              }
            }}
          >
            <Item key={TimePreset.all}>All</Item>
            <Item key={TimePreset.last_hour}>Last Hour</Item>
            <Item key={TimePreset.last_day}>Last Day</Item>
            <Item key={TimePreset.last_week}>Last Week</Item>
            <Item key={TimePreset.last_month}>Last Month</Item>
            <Item key={TimePreset.last_3_months}>Last 3 Months</Item>
            <Item key={TimePreset.first_hour}>First Hour</Item>
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
            <Heading level={4}>primary inferences time range</Heading>
            <div>start: {fullTimeFormatter(timeRange.start)}</div>
            <div>end: {fullTimeFormatter(timeRange.end)}</div>
          </section>
        </Tooltip>
      </TooltipTrigger>
    </FieldColorDesignation>
  );
}
