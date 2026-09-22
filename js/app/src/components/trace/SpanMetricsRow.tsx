import { css } from "@emotion/react";
import type { HTMLAttributes, Ref } from "react";

import type { TextProps } from "@phoenix/components/core/content";
import { dotSeparatedRowCSS } from "@phoenix/components/core/styles";
import type { TextColorValue } from "@phoenix/components/core/types/style";

import { LatencyText } from "./LatencyText";
import { TokenCosts } from "./TokenCosts";
import { TokenCount } from "./TokenCount";

export type SpanMetricsValues = {
  /** Wall-clock duration of the span. `null` when the span has not ended. */
  latencyMs: number | null;
  /** Total prompt + completion tokens. Absent on spans without LLM usage. */
  tokenCountTotal?: number | null;
  /** Total cost of the span in dollars. Absent when no pricing applied. */
  costTotal?: number | null;
};

const spanMetricsRowCSS = css`
  ${dotSeparatedRowCSS}
  white-space: nowrap;
`;

/**
 * Returns whether a span has any metric worth a metrics row.
 */
export function hasSpanMetrics(metrics: SpanMetricsValues): boolean {
  return (
    metrics.latencyMs != null ||
    hasPositiveValue(metrics.tokenCountTotal) ||
    hasPositiveValue(metrics.costTotal)
  );
}

function hasPositiveValue(value: number | null | undefined): value is number {
  return typeof value === "number" && value > 0;
}

export interface SpanMetricsRowProps
  extends
    SpanMetricsValues,
    Omit<HTMLAttributes<HTMLDivElement>, "children" | "color"> {
  /**
   * Text and icon size of every metric.
   * @default "S"
   */
  size?: TextProps["size"];
  /**
   * Text color of every metric.
   * @default "text-500"
   */
  color?: TextColorValue;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A single line of span metrics in a fixed order: latency · tokens · cost.
 *
 * Each metric is drawn by the primitive that draws it elsewhere in the app
 * (`LatencyText`, `TokenCount`, `TokenCosts`) so a token count in the trace
 * tree looks like a token count in the span header. Metrics that do not apply
 * to the span are left out so the row stays short, but the order never
 * changes so the eye can scan a column of rows. The row carries no tooltips
 * of its own; wrap it in one trigger when details are wanted.
 */
export function SpanMetricsRow({
  latencyMs,
  tokenCountTotal,
  costTotal,
  size = "S",
  color = "text-500",
  ref,
  ...otherProps
}: SpanMetricsRowProps) {
  if (!hasSpanMetrics({ latencyMs, tokenCountTotal, costTotal })) {
    return null;
  }
  return (
    <div
      className="span-metrics"
      css={spanMetricsRowCSS}
      ref={ref}
      {...otherProps}
    >
      {latencyMs != null ? (
        <LatencyText
          latencyMs={latencyMs}
          showIcon={false}
          size={size}
          color={color}
        />
      ) : null}
      {hasPositiveValue(tokenCountTotal) ? (
        <TokenCount size={size} color={color}>
          {tokenCountTotal}
        </TokenCount>
      ) : null}
      {hasPositiveValue(costTotal) ? (
        <TokenCosts size={size} color={color}>
          {costTotal}
        </TokenCosts>
      ) : null}
    </div>
  );
}
