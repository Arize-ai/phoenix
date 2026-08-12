import { numberFormatter } from "@phoenix/utils/numberFormatUtils";

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
