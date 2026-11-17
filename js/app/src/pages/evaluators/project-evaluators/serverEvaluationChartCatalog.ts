import type { ChartSelectorOption } from "@phoenix/components/chart";

/** The charts the project evaluators page can show above its table. */
export type ServerEvaluationChartKey =
  | "queueThroughput"
  | "queueSize"
  | "lagByProject"
  | "evaluationsByProject"
  | "costByProject"
  | "evaluationTimeByProject";

export type ServerEvaluationChart =
  ChartSelectorOption<ServerEvaluationChartKey> & {
    /** What the chart shows, behind an info icon beside its title. */
    help: string;
  };

/** Every chart, in the order the chart picker lists them. */
export const SERVER_EVALUATION_CHARTS: readonly ServerEvaluationChart[] = [
  {
    key: "queueThroughput",
    name: "Added vs completed",
    description: "Evaluations added to and completed from the queue",
    chartType: "bar",
    help: "Evaluations queued (above) and finished (below) over time. When the top bar is taller, the queue grew.",
  },
  {
    key: "queueSize",
    name: "Queue size",
    description: "Evaluations in queue, and how many were processed",
    chartType: "line",
    help: "Evaluations in the queue over time.",
  },
  {
    key: "lagByProject",
    name: "Lag p95 by project",
    description: "How long evaluations took to finish after being queued",
    chartType: "line",
    help: "How long evaluations took from queued to finished, for 95% of each project's evaluations.",
  },
  {
    key: "evaluationsByProject",
    name: "Evaluations by project",
    description: "Evaluations completed per project over the time range",
    chartType: "barHorizontal",
    help: "Evaluations finished per project, including failures.",
  },
  {
    key: "costByProject",
    name: "Cost by project",
    description: "What each project's evaluations cost over the time range",
    chartType: "barHorizontal",
    help: "Evaluation cost per project.",
  },
  {
    key: "evaluationTimeByProject",
    name: "Evaluation time by project",
    description:
      "Total time each project's evaluations ran over the time range",
    chartType: "barHorizontal",
    help: "Total time each project's evaluations ran. All projects share the same evaluation capacity.",
  },
];

/** As many as fit side by side at a common laptop width. */
export const DEFAULT_SERVER_EVALUATION_CHART_KEYS: ServerEvaluationChartKey[] =
  ["queueThroughput", "queueSize", "lagByProject"];

const CHARTS_BY_KEY = new Map(
  SERVER_EVALUATION_CHARTS.map((chart) => [chart.key, chart])
);

/** The charts for the given keys, in their order, skipping unknown keys. */
export function getServerEvaluationCharts(
  keys: ReadonlyArray<string>
): ServerEvaluationChart[] {
  return keys.flatMap((key) => {
    const chart = CHARTS_BY_KEY.get(key as ServerEvaluationChartKey);
    return chart != null ? [chart] : [];
  });
}
