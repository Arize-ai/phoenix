import { css } from "@emotion/react";

import { findSkillTokens } from "./skillTokens";

/**
 * Shared box metrics that the overlay and the textarea must agree on exactly,
 * or the highlighted runs will drift from the characters beneath the caret.
 * These mirror `promptInputTextareaCSS`.
 */
const sharedTextBoxCSS = css`
  font-family: inherit;
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  padding: 0;
  margin: 0;
  border: none;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;
`;

const overlayCSS = css`
  ${sharedTextBoxCSS};
  position: absolute;
  inset: 0;
  pointer-events: none;
  // The overlay is the visible text layer (the textarea above it has
  // transparent text). Render in the normal prompt text color.
  color: var(--prompt-input-textarea-color);
  overflow: hidden;

  mark {
    background-color: var(--global-color-primary-300);
    color: inherit;
    border-radius: var(--global-rounding-small);
  }
`;

type Segment = { text: string; highlighted: boolean };

/**
 * Split `text` into plain and highlighted segments, marking only the tokens
 * whose names are in `recognizedSkillNames`.
 */
function buildSegments(
  text: string,
  recognizedSkillNames: ReadonlySet<string>
): Segment[] {
  const tokens = findSkillTokens(text).filter((token) =>
    recognizedSkillNames.has(token.name)
  );
  if (tokens.length === 0) {
    return [{ text, highlighted: false }];
  }
  const segments: Segment[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.start > cursor) {
      segments.push({
        text: text.slice(cursor, token.start),
        highlighted: false,
      });
    }
    segments.push({
      text: text.slice(token.start, token.end),
      highlighted: true,
    });
    cursor = token.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }
  return segments;
}

export type SkillHighlightOverlayProps = {
  /** The current textarea value. */
  value: string;
  /** Names of skills that are real and available; only these get highlighted. */
  recognizedSkillNames: ReadonlySet<string>;
  /** Forwarded to keep the overlay scroll position synced with the textarea. */
  ref?: React.Ref<HTMLDivElement>;
};

/**
 * A transparent-text backdrop rendered behind the prompt textarea that paints a
 * highlight behind each recognized `/skill-name` token.
 *
 * The textarea above it has transparent text (caret stays visible) so the user
 * effectively reads this layer. The two must share identical box metrics; see
 * `sharedTextBoxCSS`. The parent keeps `scrollTop`/`scrollLeft` in sync.
 */
export function SkillHighlightOverlay({
  value,
  recognizedSkillNames,
  ref,
}: SkillHighlightOverlayProps) {
  const segments = buildSegments(value, recognizedSkillNames);
  return (
    <div ref={ref} css={overlayCSS} aria-hidden="true">
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark key={index}>{segment.text}</mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </div>
  );
}
