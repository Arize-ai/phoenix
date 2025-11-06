import { css } from "@emotion/react";

import { FieldColorDesignation } from "@arizeai/components";

import {
  Input,
  Label,
  TextField,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { useInferences } from "@phoenix/contexts";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
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
          min-width: 365px;
        }
      `}
    >
      <FieldColorDesignation color={"designationPurple"}>
        <TooltipTrigger>
          <TextField
            size="S"
            isReadOnly
            aria-label={"reference inferences time range"}
            value={`${fullTimeFormatter(timeRange.start)} - ${fullTimeFormatter(
              timeRange.end
            )}`}
          >
            <Label>{`${nameAbbr} inferences`}</Label>
            <Input />
          </TextField>
          <Tooltip>
            <TooltipArrow />
            The static time range of the reference inferences
          </Tooltip>
        </TooltipTrigger>
      </FieldColorDesignation>
    </div>
  );
}
