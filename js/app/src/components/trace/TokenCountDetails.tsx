import type { SpanCumulativeTokenCountDetailsQuery$data } from "./__generated__/SpanCumulativeTokenCountDetailsQuery.graphql";
import type { TokenDetailTotals } from "./TokenDetailsBreakdown";
import {
  getTokenDetails,
  TokenDetailsBreakdown,
} from "./TokenDetailsBreakdown";

export type TokenCountDetailsProps = TokenDetailTotals & {
  /**
   * Qualifies the count in the heading, e.g. "Average". Omit for a plain total.
   */
  label?: string;
};

type Span = Extract<
  SpanCumulativeTokenCountDetailsQuery$data["node"],
  { __typename: "Span" }
>;

type CostDetailSummaryEntry =
  Span["cumulativeCostDetailSummaryEntries"][number];

export function getTokenCountDetailsFromCostDetails(
  costDetails: ReadonlyArray<CostDetailSummaryEntry>
): Pick<TokenCountDetailsProps, "promptDetails" | "completionDetails"> {
  const getValue = (entry: CostDetailSummaryEntry) => entry.value.tokens;
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
 * The token-count side of {@link TokenDetailsBreakdown} on its own, for
 * surfaces that show a count without its cost.
 */
export function TokenCountDetails({
  label,
  ...tokens
}: TokenCountDetailsProps) {
  return <TokenDetailsBreakdown tokens={tokens} totalLabel={label} />;
}
