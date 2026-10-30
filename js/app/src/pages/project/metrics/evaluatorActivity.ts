export type EvaluatorActivityGroup = {
  readonly projectEvaluator: {
    readonly id: string;
    readonly name: string;
  } | null;
  readonly evaluatedCount: number;
  readonly failedCount: number;
  readonly cost: number | null;
};

export type EvaluatorActivityBinGroup = {
  readonly projectEvaluator: { readonly id: string } | null;
  readonly evaluatedCount: number;
  readonly failedCount: number;
  readonly lagP95Seconds: number | null;
  readonly cost: number | null;
  readonly queueSize: number;
};

export type EvaluatorActivityBin = {
  readonly timestamp: string;
  readonly groups: ReadonlyArray<EvaluatorActivityBinGroup>;
};

export const OTHER_EVALUATORS_DATA_KEY = "otherEvaluators";

export type EvaluatorSeries = {
  /** The series' chart data key. */
  dataKey: string;
  name: string;
  /** The series' slot in the categorical palette; null for other evaluators. */
  colorIndex: number | null;
};

/**
 * One series per evaluator, ordered by evaluations run in the range, so an
 * evaluator keeps its color across charts. Evaluators past the palette, and
 * groups whose evaluator was deleted, share one "Other evaluators" series.
 */
export function getEvaluatorSeries({
  groups,
  paletteSize,
}: {
  groups: ReadonlyArray<EvaluatorActivityGroup>;
  paletteSize: number;
}): {
  series: EvaluatorSeries[];
  getDataKey: (projectEvaluatorId: string | null | undefined) => string;
} {
  const evaluators = groups
    .flatMap(({ projectEvaluator, evaluatedCount, failedCount }) =>
      projectEvaluator
        ? [{ ...projectEvaluator, runCount: evaluatedCount + failedCount }]
        : []
    )
    .sort(
      (a, b) =>
        b.runCount - a.runCount ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
    );
  const named = evaluators.slice(0, paletteSize);
  const hasOther =
    evaluators.length > paletteSize ||
    groups.some(({ projectEvaluator }) => projectEvaluator == null);
  const series: EvaluatorSeries[] = named.map(({ name }, index) => ({
    dataKey: `evaluator${index}`,
    name,
    colorIndex: index,
  }));
  if (hasOther) {
    series.push({
      dataKey: OTHER_EVALUATORS_DATA_KEY,
      name: "Other evaluators",
      colorIndex: null,
    });
  }
  const dataKeyById = new Map(
    named.map(({ id }, index) => [id, series[index].dataKey])
  );
  return {
    series,
    getDataKey: (projectEvaluatorId) =>
      (projectEvaluatorId != null && dataKeyById.get(projectEvaluatorId)) ||
      OTHER_EVALUATORS_DATA_KEY,
  };
}

export type EvaluatorSeriesMetric =
  | "evaluatedCount"
  | "failedCount"
  | "cost"
  | "lagP95Seconds";

export type EvaluatorTimeSeriesRow = { timestamp: number } & Record<
  string,
  number | null
>;

/**
 * One chart row per bin with a value per series. Counts and costs add up
 * across the evaluators a series folds together, and a series with nothing in
 * a bin reads 0. Lag takes the slowest evaluator's p95, an upper bound on the
 * folded series' p95, and stays null where nothing finished.
 */
export function getEvaluatorTimeSeriesRows({
  bins,
  series,
  getDataKey,
  metric,
}: {
  bins: ReadonlyArray<EvaluatorActivityBin>;
  series: ReadonlyArray<EvaluatorSeries>;
  getDataKey: (projectEvaluatorId: string | null | undefined) => string;
  metric: EvaluatorSeriesMetric;
}): EvaluatorTimeSeriesRow[] {
  const isLag = metric === "lagP95Seconds";
  return bins.map(({ timestamp, groups }) => {
    const row: EvaluatorTimeSeriesRow = {
      timestamp: new Date(timestamp).getTime(),
    };
    for (const { dataKey } of series) {
      row[dataKey] = isLag ? null : 0;
    }
    for (const group of groups) {
      const value = group[metric];
      if (value == null) {
        continue;
      }
      const dataKey = getDataKey(group.projectEvaluator?.id);
      const current = row[dataKey] ?? null;
      row[dataKey] =
        current == null
          ? value
          : isLag
            ? Math.max(current, value)
            : current + value;
    }
    return row;
  });
}

/** The project's queued evaluations at the end of each bin. */
export function getQueueSizeRows(
  bins: ReadonlyArray<EvaluatorActivityBin>
): { timestamp: number; queueSize: number }[] {
  return bins.map(({ timestamp, groups }) => ({
    timestamp: new Date(timestamp).getTime(),
    queueSize: groups.reduce((total, group) => total + group.queueSize, 0),
  }));
}

export type EvaluatorCostRank = {
  dataKey: string;
  name: string;
  cost: number;
  /** Percent of the evaluators' total cost, e.g. 84 for 84%. */
  share: number;
};

/** The series with a cost in the range, most expensive first. */
export function getEvaluatorCostRanking({
  groups,
  series,
  getDataKey,
}: {
  groups: ReadonlyArray<EvaluatorActivityGroup>;
  series: ReadonlyArray<EvaluatorSeries>;
  getDataKey: (projectEvaluatorId: string | null | undefined) => string;
}): EvaluatorCostRank[] {
  const costByDataKey = new Map<string, number>();
  for (const group of groups) {
    if (group.cost == null) {
      continue;
    }
    const dataKey = getDataKey(group.projectEvaluator?.id);
    costByDataKey.set(dataKey, (costByDataKey.get(dataKey) ?? 0) + group.cost);
  }
  const totalCost = [...costByDataKey.values()].reduce(
    (total, cost) => total + cost,
    0
  );
  return series
    .flatMap(({ dataKey, name }) => {
      const cost = costByDataKey.get(dataKey) ?? 0;
      return cost > 0
        ? [{ dataKey, name, cost, share: (cost / totalCost) * 100 }]
        : [];
    })
    .sort((a, b) => b.cost - a.cost);
}

const DURATION_TICK_STEPS_SECONDS = [
  1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600,
  43200, 86400,
];

/**
 * Up to `maxTickCount` evenly spaced ticks from 0 that reach `maxSeconds`, on a
 * whole duration step, so a lag axis reads "10m, 20m" rather than "8m 20s".
 */
export function getDurationTicks(
  maxSeconds: number,
  maxTickCount = 4
): number[] {
  const step =
    DURATION_TICK_STEPS_SECONDS.find(
      (candidate) => Math.ceil(maxSeconds / candidate) <= maxTickCount
    ) ?? Math.ceil(maxSeconds / maxTickCount / 86400) * 86400;
  const tickCount = Math.max(Math.ceil(maxSeconds / step), 1);
  return Array.from({ length: tickCount + 1 }, (_, i) => i * step);
}
