import { Text } from "@phoenix/components";
import {
  costFormatter,
  costPreciseFormatter,
} from "@phoenix/utils/numberFormatUtils";

/** An evaluators table's total cost cell, from the evaluator's own traces. */
export function ProjectEvaluatorCostCell({ cost }: { cost: number | null }) {
  if (cost == null) {
    return (
      <Text fontFamily="mono" color="text-700">
        --
      </Text>
    );
  }
  return <Text fontFamily="mono">{costFormatter(cost)}</Text>;
}

/** An evaluators table's cost per evaluation cell. */
export function ProjectEvaluatorCostPerRunCell({
  cost,
  runCount,
}: {
  cost: number | null;
  /** Evaluations run in the range, evaluated or failed. */
  runCount: number;
}) {
  if (cost == null || runCount === 0) {
    return (
      <Text fontFamily="mono" color="text-700">
        --
      </Text>
    );
  }
  return <Text fontFamily="mono">{costPreciseFormatter(cost / runCount)}</Text>;
}
