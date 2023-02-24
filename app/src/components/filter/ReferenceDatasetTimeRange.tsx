import {
  FieldColorDesignation,
  TextField,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";
import { css } from "@emotion/react";
import { timeFormat } from "d3-time-format";
import React from "react";

const timeFormatter = timeFormat("%x %X");
type ReferenceDatasetTimeRangeProps = {
  datasetType: DatasetType;
  /**
   * The bookend times of the dataset
   */
  timeRange: TimeRange;
};

export function ReferenceDatasetTimeRange({
  timeRange,
}: ReferenceDatasetTimeRangeProps) {
  return (
    <div
      css={css`
        .ac-textfield {
          min-width: 371px;
        }
      `}
    >
      <FieldColorDesignation color={"designationPurple"}>
        <TooltipTrigger>
          <TriggerWrap>
            <TextField
              isReadOnly
              aria-label={"reference dataset time range"}
              value={`${timeFormatter(timeRange.start)} - ${timeFormatter(
                timeRange.end
              )}`}
              addonBefore={"reference"}
            />
          </TriggerWrap>
          <Tooltip>The static time range of the reference dataset</Tooltip>
        </TooltipTrigger>
      </FieldColorDesignation>
    </div>
  );
}
