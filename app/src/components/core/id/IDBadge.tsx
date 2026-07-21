import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import { Badge } from "@phoenix/components/core/badge";
import { Text } from "@phoenix/components/core/content";
import { Icon } from "@phoenix/components/core/icon";
import { Tooltip, TooltipTrigger } from "@phoenix/components/core/tooltip";
import type { ComponentSize } from "@phoenix/components/core/types";

const SHOW_COPIED_TIMEOUT_MS = 2000;

const idBadgeCSS = css`
  all: unset;
  display: inline-flex;
  cursor: pointer;
  &:focus-visible {
    outline: 1px solid var(--global-input-field-border-color-active);
    outline-offset: 1px;
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
   * The size of the badge.
   * @default 'S'
   */
  size?: ComponentSize;
  /**
   * The text to display in the copy tooltip.
   * @default "Copy ID"
   */
  tooltipText?: string;
}

/**
 * A badge that displays an entity's ID and copies it to the clipboard when
 * pressed — the single, consolidated click-to-copy ID element. No separate
 * copy button is needed alongside it.
 */
export const IDBadge = ({
  id,
  size = "S",
  tooltipText = "Copy ID",
}: IDBadgeProps) => {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <TooltipTrigger>
      <AriaButton
        css={idBadgeCSS}
        aria-label={`${tooltipText} ${id}`}
        onPress={() => {
          copy(id);
          setIsCopied(true);
          setTimeout(() => {
            setIsCopied(false);
          }, SHOW_COPIED_TIMEOUT_MS);
        }}
      >
        <Badge size={size}>
          <Icon svgKey="ID" />
          <Text fontFamily="mono" size="S" color="text-700">
            {id}
          </Text>
          <Icon
            className="id-badge__copy-icon"
            color={isCopied ? "success" : "inherit"}
            svgKey={isCopied ? "Checkmark" : "Duplicate"}
          />
        </Badge>
      </AriaButton>
      <Tooltip offset={1}>{isCopied ? "Copied" : tooltipText}</Tooltip>
    </TooltipTrigger>
  );
};
