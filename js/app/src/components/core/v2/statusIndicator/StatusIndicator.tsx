import { css } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";

import {
  AlertTriangleFilled,
  Ban,
  Checkmark,
  CircleDashed,
  Close,
  LoaderCircle,
  MessageCircleQuestionMark,
  Minus,
  PauseFilled,
  StopFilled,
} from "@phoenix/components/core/icon/Icons";

import { swatchCSS, truncatedTextCSS } from "../styles";

/**
 * The ten categories every status value in Phoenix maps to. The design system
 * owns each category's glyph and tone; a domain owns the words.
 */
export const STATUS_CATEGORIES = [
  "pending",
  "active",
  "needs-input",
  "paused",
  "succeeded",
  "failed",
  "stopped",
  "warning",
  "off",
  "unknown",
] as const;

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export type StatusMarker = "glyph" | "dot";

export interface StatusIndicatorProps {
  category: StatusCategory;
  /**
   * The domain's word for the status. Always shown: the glyphs alone do not
   * tell the categories apart.
   */
  label: string;
  /**
   * A further fact that follows the label in subdued text: progress, a
   * reason, who acted.
   */
  detail?: string;
  /**
   * `dot` draws the category's tone without its glyph, for a status shown
   * beside other dots. Only the tone and the word carry the category then.
   * @default "glyph"
   */
  marker?: StatusMarker;
  /**
   * The width past which the label and detail truncate with an ellipsis,
   * with the full text as a native tooltip. The glyph is never truncated.
   */
  maxWidth?: CSSProperties["maxWidth"];
}

const GLYPHS: Record<StatusCategory, () => ReactNode> = {
  pending: CircleDashed,
  active: LoaderCircle,
  "needs-input": MessageCircleQuestionMark,
  paused: PauseFilled,
  succeeded: Checkmark,
  failed: Close,
  stopped: StopFilled,
  warning: AlertTriangleFilled,
  off: Ban,
  unknown: Minus,
};

const statusIndicatorCSS = css`
  --status-indicator-tone: var(--global-text-color-500);
  --status-indicator-glyph-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-75);
  min-width: 0;
  max-width: var(--status-indicator-max-width, 100%);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
  color: var(--global-text-color-900);
  white-space: nowrap;
  vertical-align: middle;

  &[data-category="active"] {
    --status-indicator-tone: var(--global-color-info);
  }
  &[data-category="needs-input"],
  &[data-category="warning"] {
    --status-indicator-tone: var(--global-color-warning);
  }
  &[data-category="succeeded"] {
    --status-indicator-tone: var(--global-color-success);
  }
  &[data-category="failed"] {
    --status-indicator-tone: var(--global-color-danger);
  }
  &[data-category="off"] {
    --status-indicator-tone: var(--global-text-color-300);
    color: var(--global-text-color-500);
  }

  .status-indicator__glyph {
    display: flex;
    flex: none;
    width: var(--status-indicator-glyph-size);
    height: var(--status-indicator-glyph-size);
    color: var(--status-indicator-tone);
    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  }
  .status-indicator__dot {
    ${swatchCSS};
    --swatch-color: var(--status-indicator-tone);
    margin: auto;
  }
  .status-indicator__text {
    ${truncatedTextCSS};
  }
  .status-indicator__detail {
    color: var(--global-text-color-500);
  }

  .marker-trigger[data-explanation] > & .status-indicator__text {
    text-decoration: underline dotted;
    text-decoration-color: var(--global-text-color-300);
    text-underline-offset: 3px;
  }
  .marker-trigger[data-hovered] > & .status-indicator__text,
  .marker-trigger[data-pressed] > & .status-indicator__text {
    text-decoration: underline solid;
    text-decoration-color: currentColor;
    text-underline-offset: 3px;
  }
  .marker-trigger[data-disabled] > & {
    opacity: var(--global-opacity-disabled);
  }
`;

/**
 * A Status: the lifecycle or health of a thing, from a closed set. Drawn as a
 * glyph and a word with no container, on every surface, headers included.
 *
 * The glyph carries the category and its tone reinforces it, so the status
 * still reads in grayscale: five tones cannot tell ten categories apart, and
 * five of the categories are neutral.
 *
 * - **Under way**: `pending` (accepted, not started), `active` (in progress),
 *   `needs-input` (halted by the system until a person acts: an approval, an
 *   answer, credentials), `paused` (held by a person on purpose and
 *   resumable; nothing is required)
 * - **Settled**: `succeeded` (finished, or ready), `failed` (ended
 *   abnormally, or cannot be used), `stopped` (ended early on purpose, for
 *   good: cancelled, denied, skipped)
 * - **No outcome**: `warning` (works, but needs attention), `off` (disabled,
 *   not installed, or does not apply), `unknown` (no value was reported)
 *
 * A status is never its own hit target. One that must explain itself (why
 * a provider is unavailable) or open detail goes inside a `MarkerTrigger`,
 * which underlines the label to show it. A value that fits no category is
 * usually two axes, such as a lifecycle and an outcome, each in its own slot.
 *
 * Where space is tight, show only the statuses worth noticing rather than
 * dropping the word: a trace tree row marks a failed span and leaves an
 * unremarkable one unmarked. Wherever a status is shown, its word is too.
 *
 * `marker="dot"` trades the glyph for a dot in the category's tone. An
 * identity color that judges nothing, such as an experiment's series color,
 * is a `SwatchedName`, never a status.
 */
export function StatusIndicator({
  category,
  marker = "glyph",
  label,
  detail,
  maxWidth,
}: StatusIndicatorProps) {
  const Glyph = marker === "glyph" ? GLYPHS[category] : null;
  return (
    <span
      className="status-indicator"
      css={statusIndicatorCSS}
      data-category={category}
      data-marker={marker}
      style={
        maxWidth !== undefined
          ? ({ "--status-indicator-max-width": maxWidth } as CSSProperties)
          : undefined
      }
      title={
        maxWidth !== undefined
          ? detail
            ? `${label} · ${detail}`
            : label
          : undefined
      }
    >
      <span className="status-indicator__glyph" aria-hidden>
        {Glyph ? <Glyph /> : <span className="status-indicator__dot" />}
      </span>
      <span className="status-indicator__text">
        {label}
        {detail ? (
          <span className="status-indicator__detail"> · {detail}</span>
        ) : null}
      </span>
    </span>
  );
}
