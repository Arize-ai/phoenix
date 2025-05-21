import { timeFormat } from "d3-time-format";
import { css } from "@emotion/react";

import {
  FieldColorDesignation,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Input, Label, TextField } from "@phoenix/components";
import { useInferences } from "@phoenix/contexts";

const timeFormatter = timeFormat("%x %X");
type ReferenceInferencesTimeRangeProps = {
  inferencesRole: InferencesRole;
  /**
   * The bookend times of the inferences
   */
  timeRange: TimeRange;
};

export function ReferenceInferencesTimeRange({
  timeRange,
}: ReferenceInferencesTimeRangeProps) {
  const { referenceInferences } = useInferences();
  const name = referenceInferences?.name ?? "reference";
  const nameAbbr = name.slice(0, 10);
  return (
    <div
      css={css`
        .ac-textfield {
          min-width: 331px;
        }
      `}
    >
      <FieldColorDesignation color={"designationPurple"}>
        <TooltipTrigger>
          <TriggerWrap>
            <TextField
              isReadOnly
              aria-label={"reference inferences time range"}
              value={`${timeFormatter(timeRange.start)} - ${timeFormatter(
                timeRange.end
              )}`}
            >
              <Label>{`${nameAbbr} inferences`}</Label>
              <Input />
            </TextField>
          </TriggerWrap>
          <Tooltip>The static time range of the reference inferences</Tooltip>
        </TooltipTrigger>
      </FieldColorDesignation>
    </div>
  );
}
