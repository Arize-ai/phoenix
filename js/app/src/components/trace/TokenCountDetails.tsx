import { numberFormatter } from "@phoenix/utils/numberFormatUtils";

import type { SpanCumulativeTokenCountDetailsQuery$data } from "./__generated__/SpanCumulativeTokenCountDetailsQuery.graphql";
import type { TokenDetailsBreakdownProps } from "./TokenDetailsBreakdown";
import { TokenDetailsBreakdown } from "./TokenDetailsBreakdown";

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
  const getDetails = (isPrompt: boolean) => {
    const entries = costDetails.flatMap((detail) =>
      detail.isPrompt === isPrompt && detail.value.tokens != null
        ? [[detail.tokenType, detail.value.tokens] as const]
        : []
    );
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  return {
    promptDetails: getDetails(true),
    completionDetails: getDetails(false),
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
