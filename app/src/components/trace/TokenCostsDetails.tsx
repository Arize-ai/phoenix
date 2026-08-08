import { costFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TokenDetailsBreakdownProps } from "./TokenDetailsBreakdown";
import { TokenDetailsBreakdown } from "./TokenDetailsBreakdown";

export type TokenCostsDetailsProps = Omit<
  TokenDetailsBreakdownProps,
  "valueLabel" | "totalLabel" | "formatter"
> & {
  /**
   * The label for the cost details. Defaults to "Total".
   */
  label?: string;
};

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
