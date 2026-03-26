import {
  Badge,
  Icon,
  Icons,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import type { BadgeVariant } from "@phoenix/components/core/badge/types";

type ExperimentStatusValue = "RUNNING" | "COMPLETED" | "ERROR" | "STOPPED";

function getStatusVariant(status: ExperimentStatusValue): BadgeVariant {
  switch (status) {
    case "RUNNING":
      return "info";
    case "COMPLETED":
      return "success";
    case "ERROR":
      return "danger";
    case "STOPPED":
      return "warning";
  }
}

function getStatusIcon(status: ExperimentStatusValue) {
  switch (status) {
    case "RUNNING":
      return <Icons.LoadingOutline />;
    case "COMPLETED":
      return <Icons.CheckmarkCircleOutline />;
    case "ERROR":
      return <Icons.CloseCircleOutline />;
    case "STOPPED":
      return <Icons.StopCircleOutline />;
  }
}

function getStatusLabel(status: ExperimentStatusValue): string {
  switch (status) {
    case "RUNNING":
      return "running";
    case "COMPLETED":
      return "completed";
    case "ERROR":
      return "error";
    case "STOPPED":
      return "stopped";
  }
}

function getStatusTooltip(status: ExperimentStatusValue): string {
  switch (status) {
    case "RUNNING":
      return "Experiment is currently in progress";
    case "COMPLETED":
      return "Experiment has finished successfully";
    case "ERROR":
      return "Experiment encountered an error during execution";
    case "STOPPED":
      return "Experiment was manually stopped before completion";
  }
}

export function ExperimentStatus({
  status,
}: {
  status: string | null | undefined;
}) {
  if (status == null) {
    return (
      <TooltipTrigger>
        <TriggerWrap>
          <Badge variant="default" size="M">
            N/A
          </Badge>
        </TriggerWrap>
        <Tooltip offset={4}>
          <TooltipArrow />
          No background job associated with this experiment
        </Tooltip>
      </TooltipTrigger>
    );
  }
  const validStatus = status as ExperimentStatusValue;
  return (
    <TooltipTrigger>
      <TriggerWrap>
        <Badge variant={getStatusVariant(validStatus)} size="M">
          <Icon svg={getStatusIcon(validStatus)} />
          {getStatusLabel(validStatus)}
        </Badge>
      </TriggerWrap>
      <Tooltip offset={4}>
        <TooltipArrow />
        {getStatusTooltip(validStatus)}
      </Tooltip>
    </TooltipTrigger>
  );
}
