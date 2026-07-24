import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

import { CopyToClipboardButton } from "@phoenix/components";
import { interactionRevealCSS } from "@phoenix/components/core/styles";

/**
 * Wraps content with a copy-to-clipboard button that is revealed on hover in
 * the top right corner of the content.
 */
export function CopyToClipboardWrap({
  text,
  children,
  padding,
}: PropsWithChildren<{ text: string; padding?: "size-100" }>) {
  const paddingValue = padding ? `var(--global-dimension-${padding})` : "0";
  return (
    <div
      css={css`
        position: relative;
        .copy-to-clipboard-button {
          ${interactionRevealCSS}
          transition: opacity 0.2s ease-in-out;
          position: absolute;
          right: ${paddingValue};
          top: ${paddingValue};
          z-index: 1;
        }
        &:hover .copy-to-clipboard-button {
          opacity: 1;
        }
      `}
    >
      <CopyToClipboardButton text={text} />
      {children}
    </div>
  );
}
