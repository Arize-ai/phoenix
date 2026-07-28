import { costFormatter } from "@phoenix/utils/numberFormatUtils";

import { TokenDetailsBreakdown } from "./TokenDetailsBreakdown";

export interface TokenCostsDetailsProps {
  total?: number | null;
  prompt?: number | null;
  completion?: number | null;
  promptDetails?: Record<string, number | null> | null;
  completionDetails?: Record<string, number | null> | null;
  /**
   * The label for the cost details. Defaults to "Total".
   */
  label?: string;
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
