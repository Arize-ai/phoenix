import { css } from "@emotion/react";

import { Flex } from "@phoenix/components";

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
  /** Token totals and their breakdown. Omit for spans without LLM usage. */
  tokens?: TokenCountDetailsProps | null;
  /** Cost totals and their breakdown. Omit when no pricing applied. */
  costs?: TokenCostsDetailsProps | null;
};

/**
 * The breakdowns behind a span's metrics row: tokens, then cost. Latency
 * has nothing to break down, so the row or header that shows it is left to
 * carry it alone.
 *
 * @remarks
 * Pure render over plain values, so any surface can draw it from whatever
 * data it already has. Renders nothing when neither breakdown applies. `SpanMetricsDetails` and its siblings supply the data
 * from a Relay fragment, a lazy query, or a preloaded query.
 */
export function SpanMetricsDetailsView({
  tokens,
  costs,
}: SpanMetricsDetailsViewProps) {
  if (!tokens && !costs) {
    return null;
  }
  return (
    <Flex direction="column">
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
