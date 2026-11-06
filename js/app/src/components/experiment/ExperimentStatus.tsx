import type { StatusCategory } from "@phoenix/components";
import { MarkerTrigger, StatusIndicator } from "@phoenix/components";

type ExperimentStatusValue = "RUNNING" | "COMPLETED" | "ERROR" | "STOPPED";

const EXPERIMENT_STATUSES: Record<
  ExperimentStatusValue,
  { category: StatusCategory; label: string; explanation: string }
> = {
  RUNNING: {
    category: "running",
    label: "Running",
    explanation: "Experiment is currently in progress",
  },
  COMPLETED: {
    category: "succeeded",
    label: "Completed",
    explanation: "Experiment has finished successfully",
  },
  ERROR: {
    category: "failed",
    label: "Error",
    explanation: "Experiment encountered an error during execution",
  },
  STOPPED: {
    category: "stopped",
    label: "Stopped",
    explanation: "Experiment was manually stopped before completion",
  },
};

const NO_JOB_STATUS = {
  category: "unset",
  label: "N/A",
  explanation: "No background job associated with this experiment",
} satisfies (typeof EXPERIMENT_STATUSES)[ExperimentStatusValue];

export function ExperimentStatus({
  status,
}: {
  status: string | null | undefined;
}) {
  const { category, label, explanation } =
    status == null
      ? NO_JOB_STATUS
      : EXPERIMENT_STATUSES[status as ExperimentStatusValue];
  return (
    <MarkerTrigger explanation={explanation}>
      <StatusIndicator category={category} label={label} />
    </MarkerTrigger>
  );
}
