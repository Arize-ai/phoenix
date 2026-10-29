import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { DecisionAnswerList } from "@phoenix/components/decision/DecisionAnswerList";
import { normalizeDecisionResult } from "@phoenix/components/decision/decisionAnswers";
import type { DecisionPromptDraft } from "@phoenix/store/playground/types";

const tabularNumbersCSS = css`
  font-variant-numeric: tabular-nums;
`;

/**
 * The model that answered and its token usage on one line.
 * @param params.model - the model the provider reports, if any
 * @param params.usage - input and output token counts, if reported
 */
export function formatUsage({
  model,
  usage,
}: {
  model: string | null;
  usage: { input: number | null; output: number | null };
}): string {
  const parts = [
    model,
    usage.input != null ? `${usage.input} in` : null,
    usage.output != null ? `${usage.output} out` : null,
  ].filter((part): part is string => part != null);
  return parts.length ? parts.join(" · ") : "usage unavailable";
}

function parseOutput(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

/** Every answer for one instance as distributions, then the usage line. */
export function DecisionResult({
  output,
  request,
  showUsage = true,
}: {
  output: string;
  request: DecisionPromptDraft | null;
  /** Leave out the model and usage line, where the surrounding view shows them. */
  showUsage?: boolean;
}) {
  const result = normalizeDecisionResult({
    result: parseOutput(output),
    draft: request,
  });
  return (
    <Flex direction="column" gap="size-200">
      <DecisionAnswerList answers={result.answers} />
      {showUsage ? (
        <Text size="XS" color="text-700" css={tabularNumbersCSS}>
          {formatUsage({ model: result.model, usage: result.usage })}
        </Text>
      ) : null}
    </Flex>
  );
}
