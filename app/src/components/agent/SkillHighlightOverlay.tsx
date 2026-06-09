import { css } from "@emotion/react";

import { findSkillTokens } from "@phoenix/agent/skills/requestedSkills";

/**
 * Shared box metrics that the overlay and the textarea must agree on exactly,
 * or the highlighted runs will drift from the characters beneath the caret.
 * These mirror `promptInputTextareaCSS`.
 */
const sharedTextBoxCSS = css`
  font-family: inherit;
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  // Padding gives the per-line highlight breathing room from the overlay's clip
  // edges (overflow: hidden) so its tint and rounded corners aren't cut off —
  // vertically on the first/last line, and horizontally for a token at the
  // start/end of a line (which also extends past the glyphs, see the mark
  // rule). MUST stay identical to the textarea's padding (see textareaCSS in
  // SkillPromptInput) or the highlighted runs will drift from the caret.
  padding: var(--global-dimension-size-50);
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
  // Match the textarea's box model so the padded content area lines up exactly.
  box-sizing: border-box;
  pointer-events: none;
  // The overlay is the visible text layer (the textarea above it has
  // transparent text). Render in the normal prompt text color.
  color: var(--prompt-input-textarea-color);
  overflow: hidden;

  mark {
    // Tint recognized skill tokens with a very subtle purple so they read as
    // "active" without competing with the text. We derive the tint from the
    // purple palette via relative-color syntax — the same idiom the inline
    // attachment chips use — keeping the color's hue/lightness but at a low
    // alpha. This is theme-aware (purple-500 adapts per theme) and avoids the
    // -rgb companion, which the light theme doesn't define.
    background-color: lch(from var(--global-color-purple-500) l c h / 0.45);
    color: inherit;
    border-radius: var(--global-rounding-small);
    // Give the highlight a little horizontal breathing room. Padding pairs with
    // an equal negative margin so the text flow — and the caret alignment with
    // the textarea above (see sharedTextBoxCSS) — stays unchanged while the
    // tint paints wider. We extend horizontally rather than vertically because
    // the overlay clips (overflow: hidden), so a vertical/box-shadow spread
    // would be cut off on the top line.
    padding: 0 0.15em;
    margin: 0 -0.15em;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
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
  const seen = new Set<string>();
  const tokens = findSkillTokens(text).filter((token) => {
    if (!recognizedSkillNames.has(token.name) || seen.has(token.name)) {
      return false;
    }
    seen.add(token.name);
    return true;
  });
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
