import type { StatusCategory } from "@phoenix/components";
import {
  StatusIndicator,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";

type ExperimentStatusValue = "RUNNING" | "COMPLETED" | "ERROR" | "STOPPED";

const EXPERIMENT_STATUSES: Record<
  ExperimentStatusValue,
  { category: StatusCategory; label: string; tooltip: string }
> = {
  RUNNING: {
    category: "active",
    label: "Running",
    tooltip: "Experiment is currently in progress",
  },
  COMPLETED: {
    category: "succeeded",
    label: "Completed",
    tooltip: "Experiment has finished successfully",
  },
  ERROR: {
    category: "failed",
    label: "Error",
    tooltip: "Experiment encountered an error during execution",
  },
  STOPPED: {
    category: "stopped",
    label: "Stopped",
    tooltip: "Experiment was manually stopped before completion",
  },
};

const NO_JOB_STATUS = {
  category: "off",
  label: "N/A",
  tooltip: "No background job associated with this experiment",
} satisfies (typeof EXPERIMENT_STATUSES)[ExperimentStatusValue];

export function ExperimentStatus({
  status,
}: {
  status: string | null | undefined;
}) {
  const { category, label, tooltip } =
    status == null
      ? NO_JOB_STATUS
      : EXPERIMENT_STATUSES[status as ExperimentStatusValue];
  return (
    <TooltipTrigger>
      <TriggerWrap>
        <StatusIndicator category={category} label={label} />
      </TriggerWrap>
      <Tooltip offset={4}>
        <TooltipArrow />
        {tooltip}
      </Tooltip>
    </TooltipTrigger>
  );
}
