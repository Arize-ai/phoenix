import { getTokenCostDetailsFromCostDetails } from "@phoenix/components/trace/TokenCostsDetails";
import { getTokenCountDetailsFromCostDetails } from "@phoenix/components/trace/TokenCountDetails";
import type { TokenDetailsBreakdownProps } from "@phoenix/components/trace/TokenDetailsBreakdown";

import type { SessionTurnPreviewTooltipUsageQuery$data } from "./__generated__/SessionTurnPreviewTooltipUsageQuery.graphql";

type VerticalSpan = { top: number; bottom: number };

/**
 * Whether any of `rect` lies within `view`. Edges count as inside, so
 * elements without layout (zero-sized rects, as in jsdom) count as visible.
 */
export function isSpanInView(rect: VerticalSpan, view: VerticalSpan): boolean {
  return rect.bottom >= view.top && rect.top <= view.bottom;
}

export const EMPTY_METRICS_DETAILS: TokenDetailsBreakdownProps = {};

type UsageNode = SessionTurnPreviewTooltipUsageQuery$data["node"];

/**
 * Maps the usage query onto the breakdown's props; see
 * `SessionTurnPreviewTooltipUsageQuery` for which scope each measure
 * comes from.
 */
export function getTurnMetricsDetails(
  node: UsageNode
): TokenDetailsBreakdownProps {
  if (node.__typename !== "Trace") {
    return EMPTY_METRICS_DETAILS;
  }
  const { rootSpan, costSummary, costDetailSummaryEntries } = node;
  return {
    tokens: rootSpan
      ? {
          total: rootSpan.cumulativeTokenCountTotal,
          prompt: rootSpan.cumulativeTokenCountPrompt,
          completion: rootSpan.cumulativeTokenCountCompletion,
          ...getTokenCountDetailsFromCostDetails(
            rootSpan.cumulativeCostDetailSummaryEntries
          ),
        }
      : null,
    costs: {
      total: costSummary.total.cost,
      prompt: costSummary.prompt.cost,
      completion: costSummary.completion.cost,
      ...getTokenCostDetailsFromCostDetails(costDetailSummaryEntries),
    },
  };
}
