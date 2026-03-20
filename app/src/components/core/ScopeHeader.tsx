import { css } from "@emotion/react";
import type { ReactNode } from "react";

import type { StylableProps } from "./types";

interface ScopeHeaderMetric {
  label: string;
  value: ReactNode;
}

interface ScopeHeaderProps extends StylableProps {
  /**
   * The prominent human-readable name (e.g. root span name, session ID).
   */
  name: ReactNode;
  /**
   * Optional status indicator at the leftmost position (e.g. SpanStatusCodeIcon).
   */
  statusIndicator?: ReactNode;
  /**
   * Optional trailing badge after the name (e.g. SpanKindToken).
   */
  trailingVisual?: ReactNode;
  /**
   * A copyable system reference identifier, rendered as InteractiveValue.
   * Placed after trailingVisual on the name row; wraps naturally when tight.
   */
  referenceId?: ReactNode;
  /**
   * Inline metadata pairs displayed as compact `label value` items.
   */
  metrics?: ScopeHeaderMetric[];
  /**
   * Trailing actions (e.g. buttons, menus) aligned to the far right.
   */
  extra?: ReactNode;
}

const scopeHeaderCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-static-size-50);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  border-bottom: 1px solid var(--global-border-color-dark);
`;

const nameRowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-static-size-100);
  flex-wrap: wrap;
`;

const nameCSS = css`
  font-size: var(--global-font-size-l);
  line-height: var(--global-line-height-l);
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const referenceCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-static-size-50);
`;

const extraCSS = css`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--global-dimension-static-size-100);
  flex-shrink: 0;
`;

const metricsRowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-static-size-150);
  flex-wrap: wrap;
`;

const metricCSS = css`
  display: inline-flex;
  align-items: baseline;
  gap: var(--global-dimension-static-size-50);
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
`;

const metricLabelCSS = css`
  color: var(--global-text-color-500);
`;

const metricValueCSS = css`
  color: var(--global-text-color-900);
`;

export function ScopeHeader({
  name,
  statusIndicator,
  trailingVisual,
  referenceId,
  metrics,
  extra,
  css: cssProp,
}: ScopeHeaderProps) {
  const hasMetrics = metrics != null && metrics.length > 0;

  return (
    <header css={css(scopeHeaderCSS, cssProp)} className="scope-header">
      <div css={nameRowCSS} className="scope-header__name-row">
        {statusIndicator}
        <span css={nameCSS} className="scope-header__name">
          {name}
        </span>
        {trailingVisual}
        {referenceId && (
          <span css={referenceCSS} className="scope-header__reference">
            {referenceId}
          </span>
        )}
        {extra && (
          <span css={extraCSS} className="scope-header__extra">
            {extra}
          </span>
        )}
      </div>
      {hasMetrics && (
        <div css={metricsRowCSS} className="scope-header__metrics">
          {metrics.map((metric) => (
            <span key={metric.label} css={metricCSS}>
              <span css={metricLabelCSS}>{metric.label}</span>
              <span css={metricValueCSS}>{metric.value}</span>
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

export type { ScopeHeaderProps, ScopeHeaderMetric };
