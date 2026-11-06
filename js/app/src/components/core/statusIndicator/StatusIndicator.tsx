import { css, keyframes } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";

import {
  Ban,
  Checkmark,
  Close,
  Hand,
  Key,
  LoaderCircle,
  MessageCircleQuestionMark,
  Minus,
  Record,
  Stop,
} from "@phoenix/components/core/icon/Icons";

/**
 * The categories status values in Phoenix map to. The design system owns
 * each category's glyph and color; a domain owns the words.
 */
export const STATUS_CATEGORIES = [
  "running",
  "recording",
  "needs-input",
  "succeeded",
  "failed",
  "stopped",
  "denied",
  "needs-credentials",
  "disabled",
  "unavailable",
  "unset",
] as const;

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export interface StatusIndicatorProps {
  category: StatusCategory;
  /**
   * The domain's word for the status. Shown beside the glyph unless
   * `isLabelHidden`, and always its accessible name.
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
  /**
   * Which side of the word the glyph sits on. Use `end` only in a column of
   * statuses: sibling rows, shown together, each carrying a status against
   * the same end edge and changing state independently, as the tool calls
   * in an agent turn do. There the glyphs line up along that edge instead
   * of jumping with the length of each word. A status that merely sits at
   * the end of its row, menu item or card keeps the glyph first.
   * @default "start"
   */
  glyphPlacement?: "start" | "end";
  /**
   * Draws the glyph alone, with the label and detail as its accessible name
   * and native tooltip. Use it where the surrounding surface already says
   * what kind of status this is, such as a table's status column or a row
   * that marks only failures.
   *
   * The hidden-label glyph takes its size from the surrounding text, at 1.2
   * times its font size, as `Icon` does; set the container's font size to
   * change it.
   */
  isLabelHidden?: boolean;
  /**
   * Draws `running`, `recording` and `succeeded` in the neutral glyph color,
   * so only the statuses that ask something of the reader keep theirs. Use
   * it in a dense list of routine statuses, such as an agent turn's tool
   * calls, where a colored check on every row would be noise.
   */
  isQuiet?: boolean;
}

const GLYPHS: Record<StatusCategory, () => ReactNode> = {
  running: LoaderCircle,
  recording: Record,
  "needs-input": MessageCircleQuestionMark,
  succeeded: Checkmark,
  failed: Close,
  stopped: Stop,
  denied: Hand,
  "needs-credentials": Key,
  disabled: Ban,
  unavailable: Minus,
  unset: Minus,
};

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const statusIndicatorCSS = css`
  --status-indicator-base-color: var(--global-text-color-500);
  --status-indicator-glyph-size: 1.2em;
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

  &[data-label-hidden] {
    font-size: inherit;
    line-height: inherit;
  }

  &[data-glyph-placement="end"] {
    flex-direction: row-reverse;
  }

  &[data-category="running"] {
    --status-indicator-base-color: var(--global-color-primary);
  }
  &[data-category="recording"] {
    --status-indicator-base-color: var(--global-color-red-600);
  }
  &[data-category="needs-input"] {
    --status-indicator-base-color: var(--global-color-warning);
  }
  &[data-category="succeeded"] {
    --status-indicator-base-color: var(--global-color-success);
  }
  &[data-category="failed"] {
    --status-indicator-base-color: var(--global-color-danger);
  }
  &[data-category="disabled"],
  &[data-category="unavailable"],
  &[data-category="unset"] {
    --status-indicator-base-color: var(--global-text-color-300);
    color: var(--global-text-color-500);
  }
  &[data-quiet][data-category="running"],
  &[data-quiet][data-category="recording"],
  &[data-quiet][data-category="succeeded"] {
    --status-indicator-base-color: var(--global-text-color-500);
  }

  .status-indicator__glyph {
    display: flex;
    flex: none;
    width: var(--status-indicator-glyph-size);
    height: var(--status-indicator-glyph-size);
    color: var(--status-indicator-base-color);
    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  }
  &[data-category="running"] .status-indicator__glyph svg {
    animation: ${spin} 1s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    &[data-category="running"] .status-indicator__glyph svg {
      animation: none;
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
 * The glyph carries the category and its color reinforces it, so the status
 * still reads in grayscale: there are fewer colors than categories, and many
 * categories are neutral. Two categories share a glyph only when a reader
 * would respond to them the same way, as `unavailable` and `unset` do; the
 * label tells them apart.
 *
 * - **Under way**: `running` (work under way: executing, downloading),
 *   `recording` (work under way whose results are being kept: an experiment
 *   recorded from the playground), `needs-input` (halted partway until a person answers: an approval, a
 *   question)
 * - **Settled**: `succeeded` (finished, or ready), `failed` (ended
 *   abnormally, or cannot be used), `stopped` (ended early on purpose, for
 *   good: cancelled, skipped), `denied` (a person declined a request, for
 *   any reason: a rejected tool call or approval)
 * - **No outcome**: `needs-credentials` (cannot be used until someone supplies
 *   credentials: an API key, a token), `disabled` (turned off by a person or a
 *   policy), `unavailable` (cannot be used here yet or at all, though nobody
 *   turned it off: not installed, not downloaded, not supported in this
 *   browser), `unset` (nothing has been set or recorded)
 *
 * Categories are shared vocabulary, not a closed list. Add one when a
 * meaning recurs in more than one domain, asks the same of the reader each
 * time, and would be misdescribed by every existing category. One domain's
 * vocabulary is a label, not a category. Name a category for what is true of
 * the thing, and give it a glyph whose metaphor holds in every use. A value
 * that fits no category is often two axes, such as a lifecycle and an
 * outcome, each in its own slot; extra facts go in `detail`.
 *
 * Color belongs to the category and matches how the status reads in a list of
 * everything. `needs-credentials` is gray, because a page of providers nobody
 * has set up is not an alarm. `needs-input` uses the warning color, because it
 * only arises inside a task that is under way. When a status stands between the
 * viewer and what they are trying to do, the task's own surface says so — an
 * alert beside the action, a disabled action with its reason, a trigger that
 * opens the fix — rather than a recolored status.
 *
 * A status is never its own hit target. One that must explain itself (why
 * a provider is unavailable) or open detail goes inside a `MarkerTrigger`,
 * which underlines the label to show it.
 *
 * The glyph leads the word. In a column of statuses stacked against a
 * shared end edge, such as an agent turn's tool calls, it trails the word
 * instead (`glyphPlacement="end"`) so the glyphs form a column; being
 * end-aligned alone is not a reason to move it.
 *
 * The word is hidden (`isLabelHidden`) where the surface already says what
 * the status is about: a table's status column, a trace tree row or an
 * experiment's name cell, which marks only the runs worth noticing, and an
 * agent turn's tool calls. The label stays the glyph's accessible name and
 * tooltip. A card or header that names the thing keeps the word.
 *
 * The glyph is 1.2 times the font size it is drawn in, the ratio `Icon`
 * uses. A status with its word sets that font size itself (12px text, a
 * 14.4px glyph), so it looks the same everywhere. A hidden-label status sets
 * none and takes the surrounding text's: a 16.8px glyph in a 14px table
 * cell, 14.4px in a 12px tool-call row. Size it through its container.
 *
 * In a dense list of routine statuses, `isQuiet` draws the under-way and
 * succeeded glyphs neutral, so a failure or a question stands out.
 */
export function StatusIndicator({
  category,
  label,
  detail,
  maxWidth,
  glyphPlacement = "start",
  isLabelHidden = false,
  isQuiet = false,
}: StatusIndicatorProps) {
  const Glyph = GLYPHS[category];
  const fullText = detail ? `${label} · ${detail}` : label;
  if (isLabelHidden) {
    return (
      <span
        className="status-indicator"
        css={statusIndicatorCSS}
        data-category={category}
        data-quiet={isQuiet || undefined}
        data-label-hidden
        role="img"
        aria-label={fullText}
        title={fullText}
      >
        <span className="status-indicator__glyph">
          <Glyph />
        </span>
      </span>
    );
  }
  return (
    <span
      className="status-indicator"
      css={statusIndicatorCSS}
      data-category={category}
      data-glyph-placement={glyphPlacement}
      data-quiet={isQuiet || undefined}
      style={
        maxWidth !== undefined
          ? ({ "--status-indicator-max-width": maxWidth } as CSSProperties)
          : undefined
      }
      title={maxWidth !== undefined ? fullText : undefined}
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
