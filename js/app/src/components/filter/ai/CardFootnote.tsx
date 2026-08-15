import { css } from "@emotion/react";
import type { ReactNode } from "react";

const cardFootnoteCSS = css`
  display: flex;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
  border-top: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  /* The footnote is the surface's footer: its rule spans the full width,
     escaping the standard size-200 body padding every host provides, while
     the text stays aligned with the body content */
  margin-inline: calc(-1 * var(--global-dimension-size-200));
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200) 0;
  color: var(--global-text-color-500);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
  .card-footnote__icon {
    flex: none;
    display: inline-flex;
    font-size: var(--global-font-size-s);
    /* Optically center the icon against the first line of text */
    margin-top: 1px;
  }
`;

/**
 * The fine print at the bottom of an AI query settings card — a rule, an
 * icon that names the kind of note (privacy, informational), and the note
 * itself. Both cards on the generative AI page use it so their footers
 * align.
 */
export function CardFootnote({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div css={cardFootnoteCSS} className="card-footnote">
      <span className="card-footnote__icon">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
