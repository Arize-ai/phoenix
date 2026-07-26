import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import { Text } from "@phoenix/components/core/content";
import { Icon } from "@phoenix/components/core/icon";
import { quietHoverCSS } from "@phoenix/components/core/styles";
import { Tooltip, TooltipTrigger } from "@phoenix/components/core/tooltip";

const SHOW_COPIED_TIMEOUT_MS = 2000;

const idBadgeCSS = css`
  all: unset;
  display: inline-flex;
  box-sizing: border-box;
  min-width: 0;
  max-width: var(--global-dimension-size-5000);
  cursor: pointer;
  align-items: center;
  gap: var(--global-dimension-size-50);
  ${quietHoverCSS}

  .icon-wrap {
    flex: none;
  }
  .id-badge__text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--global-badge-border-radius);
  }
  &[data-hovered] .id-badge__copy-icon {
    color: var(--global-text-color-900);
  }
  .id-badge__copy-icon {
    font-size: 12px;
    color: var(--global-text-color-500);
    transition: color 0.2s;
  }
`;

interface IDBadgeProps {
  /**
   * The ID value to display in the badge.
   */
  id: string;
  /**
   * The text to display in the copy tooltip.
   * @default "Copy ID"
   */
  tooltipText?: string;
}

/**
 * Displays an entity's ID as quiet metadata and copies it to the clipboard
 * when pressed. No separate copy button is needed alongside it.
 */
export const IDBadge = ({ id, tooltipText = "Copy ID" }: IDBadgeProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyIcon = (
    <Icon
      className="id-badge__copy-icon"
      color={isCopied ? "success" : "inherit"}
      svgKey={isCopied ? "Checkmark" : "Duplicate"}
    />
  );

  return (
    <TooltipTrigger>
      <AriaButton
        css={idBadgeCSS}
        aria-label={`${tooltipText} ${id}`}
        onPress={() => {
          void copy(id);
          setIsCopied(true);
          setTimeout(() => {
            setIsCopied(false);
          }, SHOW_COPIED_TIMEOUT_MS);
        }}
      >
        <Text
          className="id-badge__text"
          fontFamily="mono"
          size="S"
          color="text-500"
        >
          {id}
        </Text>
        {copyIcon}
      </AriaButton>
      <Tooltip offset={1}>{isCopied ? "Copied" : tooltipText}</Tooltip>
    </TooltipTrigger>
  );
};
