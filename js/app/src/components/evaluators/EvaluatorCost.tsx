import {
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { TriggerWrap } from "@phoenix/components/core/tooltip";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCostsDetails } from "@phoenix/components/trace/TokenCostsDetails";
import type { EvaluatorKind } from "@phoenix/types";

type EvaluatorCostProps = {
  evaluatorKind: EvaluatorKind;
  costSummary:
    | {
        readonly total: { readonly cost: number | null };
        readonly prompt: { readonly cost: number | null };
        readonly completion: { readonly cost: number | null };
      }
    | null
    | undefined;
};

export function EvaluatorCost({
  evaluatorKind,
  costSummary,
}: EvaluatorCostProps) {
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
          />
        </View>
      </RichTooltip>
    </TooltipTrigger>
  );
}
