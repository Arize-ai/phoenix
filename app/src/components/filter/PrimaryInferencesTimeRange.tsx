import { css } from "@emotion/react";

import { FieldColorDesignation } from "@arizeai/components";

import {
  Button,
  Heading,
  Label,
  ListBox,
  Popover,
  RichTooltip,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  TooltipTrigger,
} from "@phoenix/components";
import { useInferences } from "@phoenix/contexts";
import { TimePreset, useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

type PrimaryInferencesTimeRangeProps = object;

const primaryInferencesSelectCSS = css`
  /* Align with other toolbar components */
  .react-aria-Button {
    height: 30px;
    min-height: 30px;
  }

  .react-aria-Label {
    padding: 5px 0;
    display: inline-block;
    font-size: var(--ac-global-dimension-static-font-size-75);
    font-weight: var(--px-font-weight-heavy);
  }
`;

const triggerWrapCSS = css`
  /* Target the button element specifically */
  button[aria-haspopup="listbox"] {
    border: 1.1px solid var(--ac-global-color-designation-turquoise) !important;
    border-radius: var(--ac-global-rounding-small) !important;

    &:hover {
      border-color: white !important;
    }
  }
`;

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
    <div css={triggerWrapCSS}>
      <FieldColorDesignation color={"designationTurquoise"}>
        <TooltipTrigger>
          <Select
            selectedKey={selectedTimePreset}
            data-testid="inferences-time-range"
            aria-label={`Time range for the primary inferences`}
            onSelectionChange={(key) => {
              if (key !== selectedTimePreset) {
                setTimePreset(key as TimePreset);
              }
            }}
            css={primaryInferencesSelectCSS}
          >
            <Label>{nameAbbr} inferences</Label>
            <Button>
              <SelectValue />
              <SelectChevronUpDownIcon />
            </Button>
            <Text slot="description">{""}</Text>
            <Popover>
              <ListBox>
                <SelectItem key={TimePreset.all} id={TimePreset.all}>
                  All
                </SelectItem>
                <SelectItem
                  key={TimePreset.last_hour}
                  id={TimePreset.last_hour}
                >
                  Last Hour
                </SelectItem>
                <SelectItem key={TimePreset.last_day} id={TimePreset.last_day}>
                  Last Day
                </SelectItem>
                <SelectItem
                  key={TimePreset.last_week}
                  id={TimePreset.last_week}
                >
                  Last Week
                </SelectItem>
                <SelectItem
                  key={TimePreset.last_month}
                  id={TimePreset.last_month}
                >
                  Last Month
                </SelectItem>
                <SelectItem
                  key={TimePreset.last_3_months}
                  id={TimePreset.last_3_months}
                >
                  Last 3 Months
                </SelectItem>
                <SelectItem
                  key={TimePreset.first_hour}
                  id={TimePreset.first_hour}
                >
                  First Hour
                </SelectItem>
                <SelectItem
                  key={TimePreset.first_day}
                  id={TimePreset.first_day}
                >
                  First Day
                </SelectItem>
                <SelectItem
                  key={TimePreset.first_week}
                  id={TimePreset.first_week}
                >
                  First Week
                </SelectItem>
                <SelectItem
                  key={TimePreset.first_month}
                  id={TimePreset.first_month}
                >
                  First Month
                </SelectItem>
              </ListBox>
            </Popover>
          </Select>
          <RichTooltip>
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
          </RichTooltip>
        </TooltipTrigger>
      </FieldColorDesignation>
    </div>
  );
}
