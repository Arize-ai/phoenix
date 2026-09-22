import { numberFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SpanCumulativeTokenCountDetailsQuery$data } from "./__generated__/SpanCumulativeTokenCountDetailsQuery.graphql";
import type { TokenDetailsBreakdownProps } from "./TokenDetailsBreakdown";
import {
  getTokenDetails,
  TokenDetailsBreakdown,
} from "./TokenDetailsBreakdown";

export type TokenCountDetailsProps = Omit<
  TokenDetailsBreakdownProps,
  "valueLabel" | "totalLabel" | "formatter"
> & {
  /**
   * The label for the count details. Defaults to "Total".
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

export function TokenCountDetails({
  total,
  prompt,
  completion,
  promptDetails,
  completionDetails,
  label = "Total",
}: TokenCountDetailsProps) {
  return (
    <TokenDetailsBreakdown
      valueLabel="tokens"
      totalLabel={label}
      formatter={numberFormatter}
      total={total}
      prompt={prompt}
      completion={completion}
      promptDetails={promptDetails}
      completionDetails={completionDetails}
    />
  );
}
