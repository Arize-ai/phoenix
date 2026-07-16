import { css } from "@emotion/react";
import { Pressable } from "react-aria";

import { Icon, Icons, Tooltip, TooltipTrigger } from "@phoenix/components";

const temporaryChatTooltipCSS = css`
  max-width: none;
  white-space: nowrap;
`;

/**
 * Ephemerality indicator shown next to a temporary chat's title, both in the
 * chat header and in the session dropdown. Persistent sessions render no
 * icon, so its presence alone marks the chat as temporary.
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
        This chat is temporary and won&apos;t be saved
      </Tooltip>
    </TooltipTrigger>
  );
}
