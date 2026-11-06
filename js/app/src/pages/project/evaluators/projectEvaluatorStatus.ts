import type { BadgeVariant } from "@phoenix/components/core/badge";
import type { ProjectEvaluatorRunStatus } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_row.graphql";

/** The run summary fields a status cell reads. */
export type ProjectEvaluatorStatusFields = {
  status: ProjectEvaluatorRunStatus;
  lastRunAt: string | null;
  queuedCount: number;
  evaluatedCount: number;
  failedCount: number;
  clearedCount: number;
  oldestWaitingOrRetryingAt?: string | null;
};

export type ProjectEvaluatorStatus = {
  label: string;
  color: string;
  variant: BadgeVariant;
  /** Why the evaluator is in this state, for states whose label doesn't say. */
  explanation: string | null;
};

/** `Badge` takes the variant; `Token` takes the color. One choice, two spellings. */
const STATUS_COLOR_BY_VARIANT: Record<BadgeVariant, string> = {
  warning: "var(--global-color-warning)",
  danger: "var(--global-color-danger)",
  success: "var(--global-color-success)",
  info: "var(--global-color-info)",
  default: "var(--global-color-gray-300)",
};

const PROJECT_EVALUATOR_STATUS_BY_RUN_STATUS: Record<
  ProjectEvaluatorRunStatus,
  Omit<ProjectEvaluatorStatus, "color">
> = {
  DISABLED: {
    label: "Disabled",
    variant: "default",
    explanation: null,
  },
  ERROR: {
    label: "Error",
    variant: "danger",
    explanation: "Last evaluation failed",
  },
  DEGRADED: {
    label: "Degraded",
    variant: "warning",
    explanation: "Its next evaluation has waited more than 10 minutes",
  },
  HEALTHY: {
    label: "Healthy",
    variant: "success",
    explanation: null,
  },
  STARTING: {
    label: "Starting",
    variant: "info",
    explanation: null,
  },
  NEVER_RUN: {
    label: "Never ran",
    variant: "default",
    explanation: null,
  },
};

/** The one status a row reports, as the server derives it. */
export function getProjectEvaluatorStatus({
  runSummary,
}: {
  // Narrowed so status cells can render without fetching run counts.
  runSummary: Pick<ProjectEvaluatorStatusFields, "status">;
}): ProjectEvaluatorStatus {
  const status = PROJECT_EVALUATOR_STATUS_BY_RUN_STATUS[runSummary.status];
  return { ...status, color: STATUS_COLOR_BY_VARIANT[status.variant] };
}
