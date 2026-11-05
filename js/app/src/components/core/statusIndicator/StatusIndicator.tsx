import { css } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";

import {
  AlertTriangleFilled,
  Ban,
  Checkmark,
  CircleDashed,
  Close,
  Key,
  LoaderCircle,
  MessageCircleQuestionMark,
  Minus,
  PauseFilled,
  StopFilled,
} from "@phoenix/components/core/icon/Icons";

/**
 * The categories status values in Phoenix map to. The design system owns
 * each category's glyph and tone; a domain owns the words.
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
  "needs-credentials",
  "off",
  "unknown",
] as const;

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

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
  "needs-credentials": Key,
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
  .status-indicator__text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
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
 * A Status: the lifecycle or health of a thing. Drawn as a glyph and a word
 * with no container, on every surface, headers included.
 *
 * The glyph carries the category and its tone reinforces it, so the status
 * still reads in grayscale: there are fewer tones than categories, and many
 * categories are neutral.
 *
 * - **Under way**: `pending` (accepted, not started), `active` (in progress),
 *   `needs-input` (halted partway until a person answers: an approval, a
 *   question), `paused` (held by a person on purpose and resumable; nothing
 *   is required)
 * - **Settled**: `succeeded` (finished, or ready), `failed` (ended
 *   abnormally, or cannot be used), `stopped` (ended early on purpose, for
 *   good: cancelled, denied, skipped)
 * - **No outcome**: `warning` (works, but needs attention),
 *   `needs-credentials` (cannot be used until someone supplies credentials:
 *   an API key, a token), `off` (disabled, not installed, or does not
 *   apply), `unknown` (no value was reported)
 *
 * Categories are shared vocabulary, not a closed list. Add one when a
 * meaning recurs in more than one domain, asks the same of the reader each
 * time, and would be misdescribed by every existing category. One domain's
 * vocabulary is a label, not a category. Name a category for what is true of
 * the thing, and give it a glyph whose metaphor holds in every use. A value
 * that fits no category is often two axes, such as a lifecycle and an
 * outcome, each in its own slot; extra facts go in `detail`.
 *
 * Tone belongs to the category and matches how the status reads in a list
 * of everything. `needs-credentials` is gray, because a page of providers
 * nobody has set up is not an alarm. `needs-input` is warning, because it
 * only arises inside a task that is under way. When a status stands between
 * the viewer and what they are trying to do, the task's own surface says so
 * — an alert beside the action, a disabled action with its reason, a
 * trigger that opens the fix — rather than a recolored status.
 *
 * A status is never its own hit target. One that must explain itself (why
 * a provider is unavailable) or open detail goes inside a `MarkerTrigger`,
 * which underlines the label to show it.
 *
 * Where space is tight, show only the statuses worth noticing rather than
 * dropping the word: a trace tree row marks a failed span and leaves an
 * unremarkable one unmarked. Wherever a status is shown, its word is too.
 */
export function StatusIndicator({
  category,
  label,
  detail,
  maxWidth,
}: StatusIndicatorProps) {
  const Glyph = GLYPHS[category];
  return (
    <span
      className="status-indicator"
      css={statusIndicatorCSS}
      data-category={category}
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
        <Glyph />
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
