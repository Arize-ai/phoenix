import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TokenCostsDetailsProps } from "./TokenCostsDetails";
import { TokenCostsDetails } from "./TokenCostsDetails";
import type { TokenCountDetailsProps } from "./TokenCountDetails";
import { TokenCountDetails } from "./TokenCountDetails";

const sectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  &:not(:first-of-type) {
    padding-top: var(--global-dimension-size-150);
    border-top: var(--global-border-size-thin) solid
      var(--global-color-gray-300);
  }
`;

export type SpanMetricsDetailsViewProps = {
  /** Wall-clock duration of the span. `null` when the span has not ended. */
  latencyMs: number | null;
  /** Token totals and their breakdown. Omit for spans without LLM usage. */
  tokens?: TokenCountDetailsProps | null;
  /** Cost totals and their breakdown. Omit when no pricing applied. */
  costs?: TokenCostsDetailsProps | null;
};

/**
 * Everything a span's metrics row summarizes, in full: latency, the token
 * breakdown, and the cost breakdown.
 *
 * @remarks
 * Pure render over plain values, so any surface can draw it from whatever
 * data it already has. `SpanMetricsDetails` and its siblings supply the data
 * from a Relay fragment, a lazy query, or a preloaded query.
 */
export function SpanMetricsDetailsView({
  latencyMs,
  tokens,
  costs,
}: SpanMetricsDetailsViewProps) {
  return (
    <Flex direction="column">
      <section css={sectionCSS}>
        <Flex direction="row" justifyContent="space-between" gap="size-200">
          <Text size="S" color="text-700">
            Latency
          </Text>
          <Text size="S" fontFamily="mono">
            {latencyMsFormatter(latencyMs)}
          </Text>
        </Flex>
      </section>
      {tokens ? (
        <section css={sectionCSS}>
          <TokenCountDetails {...tokens} />
        </section>
      ) : null}
      {costs ? (
        <section css={sectionCSS}>
          <TokenCostsDetails {...costs} />
        </section>
      ) : null}
    </Flex>
  );
}
