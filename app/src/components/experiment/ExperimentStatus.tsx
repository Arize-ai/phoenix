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
import { assertUnreachable } from "@phoenix/typeUtils";

type ExperimentStatusValue = "RUNNING" | "COMPLETED" | "ERROR" | "STOPPED";

/**
 * Narrows a raw backend status string to a known status.
 *
 * The status arrives typed as `string`, so this replaces an assertion with a
 * real check. An unrecognized value already threw before this guard existed --
 * the exhaustive switches below end in `assertUnreachable` -- so the throw
 * added at the call site preserves that behavior with a clearer message.
 */
function isExperimentStatusValue(
  value: string
): value is ExperimentStatusValue {
  return (
    value === "RUNNING" ||
    value === "COMPLETED" ||
    value === "ERROR" ||
    value === "STOPPED"
  );
}

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
    default:
      return assertUnreachable(status);
  }
}

function getStatusIcon(status: ExperimentStatusValue) {
  switch (status) {
    case "RUNNING":
      return <Icons.Loading />;
    case "COMPLETED":
      return <Icons.CheckmarkCircle />;
    case "ERROR":
      return <Icons.CloseCircle />;
    case "STOPPED":
      return <Icons.StopCircle />;
    default:
      return assertUnreachable(status);
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
    default:
      return assertUnreachable(status);
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
    default:
      return assertUnreachable(status);
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
  if (!isExperimentStatusValue(status)) {
    throw new Error(`Unexpected experiment status: ${status}`);
  }
  const validStatus = status;
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
