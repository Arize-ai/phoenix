import { css } from "@emotion/react";

const clientIconCSS = css`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--global-color-gray-100);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  color: var(--global-text-color-700);
  font-family: var(--global-font-family-mono);
  font-weight: 600;
  user-select: none;

  &[data-size="M"] {
    width: var(--global-dimension-size-450);
    height: var(--global-dimension-size-450);
    border-radius: var(--global-rounding-medium);
    font-size: var(--global-font-size-s);
  }

  &[data-size="L"] {
    width: var(--global-dimension-size-700);
    height: var(--global-dimension-size-700);
    border-radius: var(--global-rounding-large);
    font-size: var(--global-font-size-m);
  }
`;

export interface OAuth2ClientIconProps {
  /**
   * Human-readable name of the OAuth2 client application
   */
  clientName: string;
  /**
   * Whether the client is a first-party (Phoenix-verified) application.
   * First-party clients are command-line tools and render a terminal glyph;
   * third-party clients render the first letter of their name.
   */
  isFirstParty?: boolean;
  /**
   * M for inline/list usage, L for hero placements like the consent card
   * @default "M"
   */
  size?: "M" | "L";
}

function getClientInitial(clientName: string) {
  return clientName.trim().charAt(0).toUpperCase() || "?";
}

/**
 * A visual identifier for an OAuth2 client application. Shown wherever a
 * grant or authorization request references a client (consent card,
 * authorized applications list) so the same app is recognizable across
 * surfaces.
 */
export function OAuth2ClientIcon({
  clientName,
  isFirstParty = false,
  size = "M",
}: OAuth2ClientIconProps) {
  return (
    <div css={clientIconCSS} data-size={size} aria-hidden="true">
      <span>{isFirstParty ? "❯_" : getClientInitial(clientName)}</span>
    </div>
  );
}
