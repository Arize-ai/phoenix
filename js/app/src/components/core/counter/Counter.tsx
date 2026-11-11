import { css } from "@emotion/react";

import { VisuallyHidden } from "@phoenix/components/core/content";
import { useTheme } from "@phoenix/contexts/ThemeContext";
import {
  formatIntCompact,
  formatIntGrouped,
} from "@phoenix/utils/numberFormatUtils";

import { derivedColorCSS, inheritedStateCSS } from "../styles";

export type CounterVariant = "neutral" | "quiet" | "danger";

export type CounterNotation = "standard" | "compact";

export interface CounterProps {
  /**
   * How many of something the parent holds. `null` while the count is not
   * known yet, which renders a placeholder.
   */
  count: number | null;
  /**
   * The largest count shown in full. A larger count renders as `max+`.
   */
  max?: number;
  /**
   * Whether a count of zero renders. Keep it for a set whose emptiness is
   * worth seeing, such as a tab; turn it off for a notification count, which
   * should disappear when there is nothing to notice.
   * @default true
   */
  showZero?: boolean;
  /**
   * `danger` only when the count itself is the alarm, such as a count of
   * exceptions.
   * @default "neutral"
   */
  variant?: CounterVariant;
  /**
   * `compact` abbreviates to three significant digits (`12.3K`).
   * @default "standard"
   */
  notation?: CounterNotation;
}

const counterCSS = css`
  ${derivedColorCSS};
  ${inheritedStateCSS};
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  height: var(--global-dimension-size-200);
  padding: 0 var(--global-dimension-size-75);
  font-size: var(--global-font-size-xs);
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
  min-width: var(--global-dimension-size-200);
  border-radius: var(--global-rounding-large);
  font-family: var(--global-font-family-mono);
  font-variant-numeric: tabular-nums;

  &[data-variant="danger"] {
    --family-base-color: var(--global-color-danger);
  }
  &[data-variant="quiet"] {
    background-color: transparent;
    border-color: transparent;
    color: var(--global-text-color-500);
  }
`;

function formatCount({
  count,
  max,
  notation,
}: {
  count: number;
  max?: number;
  notation: CounterNotation;
}): string {
  const formatter =
    notation === "compact" ? formatIntCompact : formatIntGrouped;
  if (max !== undefined && count > max) {
    return `${formatter(max)}+`;
  }
  return formatter(count);
}

/**
 * A Count: how many of something the parent holds, set beside the label it
 * counts, such as a tab, a navigation item or a filter button. Round, because
 * it is a property of its parent.
 *
 * The parent's accessible name picks the count up from its text, so a tab
 * reads as "Traces (12)" without the parent composing a label. The visible
 * number is hidden from assistive technology and replaced by a visually
 * hidden copy that always gives the full count, since `99+` and `12.3K` are
 * abbreviations for the eye. An unknown count adds nothing to the name.
 */
export function Counter({
  count,
  max,
  showZero = true,
  variant = "neutral",
  notation = "standard",
}: CounterProps) {
  const { theme } = useTheme();
  if (count === 0 && !showZero) {
    return null;
  }
  return (
    <>
      <span
        className="counter"
        css={counterCSS}
        data-variant={variant}
        data-theme={theme}
        aria-hidden
      >
        {count === null ? "--" : formatCount({ count, max, notation })}
      </span>
      {count === null ? null : (
        <VisuallyHidden>{` (${formatIntGrouped(count)})`}</VisuallyHidden>
      )}
    </>
  );
}
