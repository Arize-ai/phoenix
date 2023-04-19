import React from "react";
import { timeFormat } from "d3-time-format";
import { css } from "@emotion/react";

import {
  FieldColorDesignation,
  TextField,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

const timeFormatter = timeFormat("%x %X");
type ReferenceDatasetTimeRangeProps = {
  datasetRole: DatasetRole;
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
