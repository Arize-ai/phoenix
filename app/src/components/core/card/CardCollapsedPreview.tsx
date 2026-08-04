import { css } from "@emotion/react";

const cardCollapsedPreviewCSS = css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  /* The preview is the last thing in the header's growing side, so its ellipsis
     would otherwise butt up against the extra slot's controls, or against the
     card's edge on a card that has none */
  padding-right: var(--global-dimension-size-200);

  /* An open card shows the real thing, so the excerpt only earns its place
     while the card is closed */
  .card[data-collapsed="false"] & {
    display: none;
  }
`;

/**
 * A one-line excerpt of a card's body, shown in its header while the card is
 * collapsed so a closed card still says something about what it holds. Pass it
 * as a card's `headerContent`:
 *
 * ```tsx
 * <Card
 *   collapsible
 *   title={role}
 *   headerContent={<CardCollapsedPreview>{preview}</CardCollapsedPreview>}
 * >
 * ```
 *
 * Takes whatever the title leaves and truncates, so previewing a card costs
 * nothing in height. Plain text only — it renders inside the collapse button on
 * a card without `interactiveTitle`, so it must not carry controls of its own.
 */
export function CardCollapsedPreview({ children }: { children?: string }) {
  if (!children) {
    return null;
  }
  return (
    // Hidden from assistive tech: on a card without `interactiveTitle` this
    // renders inside the collapse button, so it would otherwise become that
    // button's accessible name — a couple of hundred characters of body text
    // that changes on every toggle and buries the title. The body it excerpts
    // is one expand away.
    <span
      className="card__collapsed-preview"
      css={cardCollapsedPreviewCSS}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
