import { css } from "@emotion/react";
import { Pressable } from "react-aria";

import { Icon, Icons, Tooltip, TooltipTrigger } from "@phoenix/components";

const temporaryChatTooltipCSS = css`
  max-width: none;
  white-space: nowrap;
`;

/**
 * Ephemerality indicator for a temporary chat session.
 */
export function TemporarySessionIcon() {
  return (
    <TooltipTrigger delay={0}>
      <Pressable>
        <span
          role="button"
          tabIndex={0}
          aria-label="Temporary chat"
          css={css`
            display: inline-flex;
            flex: none;
            cursor: default;
            color: var(--global-text-color-700);
          `}
        >
          <Icon svg={<Icons.ChatEphemeralityOn />} />
        </span>
      </Pressable>
      <Tooltip placement="bottom" css={temporaryChatTooltipCSS}>
        This chat is temporary and won't be saved
      </Tooltip>
    </TooltipTrigger>
  );
}
