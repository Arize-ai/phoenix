import { css } from "@emotion/react";

import {
  Input,
  Label,
  TextField,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { useInferences } from "@phoenix/contexts";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";

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
  const { fullTimeFormatter } = useTimeFormatters();
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
    </div>
  );
}
