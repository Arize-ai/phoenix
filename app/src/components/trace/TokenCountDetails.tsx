import { numberFormatter } from "@phoenix/utils/numberFormatUtils";

import { TokenDetailsBreakdown } from "./TokenDetailsBreakdown";

export interface TokenCountDetailsProps {
  /**
   * Total token count
   */
  total?: number | null;
  /**
   * Prompt token count
   */
  prompt?: number | null;
  /**
   * Completion token count
   */
  completion?: number | null;
  /**
   * Additional prompt token details as key-value pairs
   */
  promptDetails?: Record<string, number | null | undefined>;
  /**
   * Additional completion token details as key-value pairs
   */
  completionDetails?: Record<string, number | null | undefined>;
  /**
   * The label for the count details. Defaults to "Total".
   */
  label?: string;
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
