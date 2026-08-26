import {
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { TriggerWrap } from "@phoenix/components/core/tooltip";
import {
  getAverageEvaluatorCostSummary,
  type EvaluatorCostSummary,
} from "@phoenix/components/evaluators/evaluatorCostUtils";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCostsDetails } from "@phoenix/components/trace/TokenCostsDetails";
import type { EvaluatorKind } from "@phoenix/types";

type EvaluatorCostProps = {
  evaluatorKind: EvaluatorKind;
  costSummary: EvaluatorCostSummary | null | undefined;
};

export function EvaluatorCost({
  evaluatorKind,
  costSummary,
}: EvaluatorCostProps) {
  return (
    <EvaluatorCostValue
      evaluatorKind={evaluatorKind}
      costSummary={costSummary}
    />
  );
}

export function EvaluatorAverageCost({
  evaluatorKind,
  costSummary,
  runCount,
}: EvaluatorCostProps & { runCount: number }) {
  return (
    <EvaluatorCostValue
      evaluatorKind={evaluatorKind}
      costSummary={getAverageEvaluatorCostSummary({ costSummary, runCount })}
      tooltipLabel="Average"
    />
  );
}

function EvaluatorCostValue({
  evaluatorKind,
  costSummary,
  tooltipLabel,
}: EvaluatorCostProps & { tooltipLabel?: string }) {
  if (evaluatorKind === "CODE") {
    return <Text color="text-700">—</Text>;
  }

  const totalCost = costSummary?.total.cost;
  if (totalCost == null) {
    return <TokenCosts size="S">{totalCost}</TokenCosts>;
  }

  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <TokenCosts size="S">{totalCost}</TokenCosts>
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <TooltipArrow />
        <View width="size-3600">
          <TokenCostsDetails
            total={totalCost}
            prompt={costSummary?.prompt.cost}
            completion={costSummary?.completion.cost}
            label={tooltipLabel}
          />
        </View>
      </RichTooltip>
    </TooltipTrigger>
  );
}
