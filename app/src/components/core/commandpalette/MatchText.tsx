import { css } from "@emotion/react";

const matchTextCSS = css`
  background-color: rgba(var(--global-color-blue-500-rgb), 0.4);
  color: inherit;
  border-radius: var(--global-rounding-xsmall);
`;

export interface MatchTextProps {
  /**
   * The full text to render
   */
  text: string;
  /**
   * The substring to highlight (case-insensitive, first occurrence)
   */
  match?: string;
}

/**
 * Renders text with the first case-insensitive occurrence of `match`
 * highlighted via a `<mark>` element so users can see why a search result
 * matched their query.
 */
export function MatchText({ text, match }: MatchTextProps) {
  const matchLength = match?.trim().length ?? 0;
  if (!match || matchLength === 0) {
    return <>{text}</>;
  }
  const matchStart = text.toLowerCase().indexOf(match.trim().toLowerCase());
  if (matchStart === -1) {
    return <>{text}</>;
  }
  const matchEnd = matchStart + matchLength;
  return (
    <>
      {text.slice(0, matchStart)}
      <mark className="match-text" css={matchTextCSS}>
        {text.slice(matchStart, matchEnd)}
      </mark>
      {text.slice(matchEnd)}
    </>
  );
}
