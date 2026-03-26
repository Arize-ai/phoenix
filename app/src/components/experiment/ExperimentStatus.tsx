import { Badge, Icon, Icons } from "@phoenix/components";
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

export function ExperimentStatus({
  status,
}: {
  status: string | null | undefined;
}) {
  if (status == null) {
    return (
      <Badge variant="default" size="S">
        N/A
      </Badge>
    );
  }
  const validStatus = status as ExperimentStatusValue;
  return (
    <Badge variant={getStatusVariant(validStatus)} size="S">
      <Icon svg={getStatusIcon(validStatus)} />
      {getStatusLabel(validStatus)}
    </Badge>
  );
}
