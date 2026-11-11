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

function isExperimentStatusValue(
  status: string
): status is ExperimentStatusValue {
  return Object.hasOwn(EXPERIMENT_STATUSES, status);
}

/**
 * A server newer than this client can report a status it does not know yet,
 * so an unrecognized value is shown by its raw name instead of throwing.
 */
function getExperimentStatusPresentation(status: string | null | undefined) {
  if (status == null) {
    return NO_JOB_STATUS;
  }
  if (isExperimentStatusValue(status)) {
    return EXPERIMENT_STATUSES[status];
  }
  return {
    category: "unset",
    label: status,
    explanation: "This version of Phoenix does not recognize this status",
  } satisfies (typeof EXPERIMENT_STATUSES)[ExperimentStatusValue];
}

export function ExperimentStatus({
  status,
  detailsHref,
  isLabelHidden,
}: {
  status: string | null | undefined;
  isLabelHidden?: boolean;
  /**
   * Makes the status a link to the experiment's details, still explaining
   * itself on hover and focus.
   */
  detailsHref?: string;
}) {
  const { category, label, explanation } =
    getExperimentStatusPresentation(status);
  const indicator = (
    <StatusIndicator
      category={category}
      label={label}
      isLabelHidden={isLabelHidden}
    />
  );
  if (detailsHref !== undefined) {
    return (
      <MarkerTrigger
        aria-label={`${label}: view experiment details`}
        href={detailsHref}
        explanation={explanation}
      >
        {indicator}
      </MarkerTrigger>
    );
  }
  return <MarkerTrigger explanation={explanation}>{indicator}</MarkerTrigger>;
}
