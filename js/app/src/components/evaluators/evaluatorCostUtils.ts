export type EvaluatorCostSummary = {
  readonly total: { readonly cost: number | null };
  readonly prompt: { readonly cost: number | null };
  readonly completion: { readonly cost: number | null };
};

/**
 * Calculate the average evaluator cost per run.
 * @param params - Evaluator cost inputs.
 * @param params.costSummary - Aggregate costs for the selected time range.
 * @param params.runCount - Evaluator runs in the same time range.
 */
export function getAverageEvaluatorCostSummary({
  costSummary,
  runCount,
}: {
  costSummary: EvaluatorCostSummary | null | undefined;
  runCount: number;
}): EvaluatorCostSummary | null {
  if (costSummary == null || runCount <= 0) {
    return null;
  }

  const getAverageCost = (cost: number | null) =>
    cost == null ? null : cost / runCount;

  return {
    total: { cost: getAverageCost(costSummary.total.cost) },
    prompt: { cost: getAverageCost(costSummary.prompt.cost) },
    completion: { cost: getAverageCost(costSummary.completion.cost) },
  };
}
