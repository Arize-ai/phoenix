import type { TokenDetailTotals } from "./TokenDetailsBreakdown";
import {
  getTokenDetails,
  TokenDetailsBreakdown,
} from "./TokenDetailsBreakdown";

export type TokenCostsDetailsProps = TokenDetailTotals & {
  /**
   * Qualifies the cost in the heading, e.g. "Average". Omit for a plain total.
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

/**
 * The cost side of {@link TokenDetailsBreakdown} on its own, for surfaces
 * that show a cost without its token count.
 */
export function TokenCostsDetails({ label, ...costs }: TokenCostsDetailsProps) {
  return <TokenDetailsBreakdown costs={costs} totalLabel={label} />;
}
