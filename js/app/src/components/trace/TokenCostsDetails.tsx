import { costFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TokenDetailsBreakdownProps } from "./TokenDetailsBreakdown";
import {
  getTokenDetails,
  TokenDetailsBreakdown,
} from "./TokenDetailsBreakdown";

export type TokenCostsDetailsProps = Omit<
  TokenDetailsBreakdownProps,
  "valueLabel" | "totalLabel" | "formatter"
> & {
  /**
   * The label for the cost details. Defaults to "Total".
   */
  label?: string;
};

type CostDetailSummaryEntry = {
  tokenType: string;
  isPrompt: boolean;
  value: { cost: number | null };
};

/**
 * Splits per-token-type cost entries into the prompt and completion detail
 * maps {@link TokenCostsDetails} draws. Mirrors
 * `getTokenCountDetailsFromCostDetails` for the cost side of the same entries.
 */
export function getTokenCostDetailsFromCostDetails(
  costDetails: ReadonlyArray<CostDetailSummaryEntry>
): Pick<TokenCostsDetailsProps, "promptDetails" | "completionDetails"> {
  const getValue = (entry: CostDetailSummaryEntry) => entry.value.cost;
  return {
    promptDetails: getTokenDetails({
      entries: costDetails,
      isPrompt: true,
      getValue,
    }),
    completionDetails: getTokenDetails({
      entries: costDetails,
      isPrompt: false,
      getValue,
    }),
  };
}

export function TokenCostsDetails({
  total,
  prompt,
  completion,
  promptDetails,
  completionDetails,
  label = "Total",
}: TokenCostsDetailsProps) {
  return (
    <TokenDetailsBreakdown
      valueLabel="cost"
      totalLabel={label}
      formatter={costFormatter}
      total={total}
      prompt={prompt}
      completion={completion}
      promptDetails={promptDetails}
      completionDetails={completionDetails}
    />
  );
}
