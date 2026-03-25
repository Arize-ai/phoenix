import { css } from "@emotion/react";
import { forwardRef } from "react";
import { Button, Keyboard, TooltipTrigger } from "react-aria-components";

import { Tooltip, TooltipArrow } from "../../core/tooltip";
import { promptInputButtonCSS } from "./styles";
import type { PromptInputButtonProps, PromptInputButtonTooltip } from "./types";

const shortcutCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
`;

function resolveTooltip(tooltip: PromptInputButtonTooltip) {
  if (typeof tooltip === "string") {
    return { content: tooltip, shortcut: undefined, side: "top" as const };
  }
  return { side: "top" as const, ...tooltip };
}

/**
 * Icon button for the toolbar area, styled like `IconButton` (square,
 * transparent background, hover opacity). Optionally wraps itself in a
 * `TooltipTrigger` when the `tooltip` prop is provided.
 *
 * @example
 * ```tsx
 * <PromptInputButton tooltip="Attach files" aria-label="Attach files">
 *   <Icon svg={<Icons.PlusOutline />} />
 * </PromptInputButton>
 *
 * <PromptInputButton tooltip={{ content: "Search", shortcut: "⌘K" }}>
 *   <Icon svg={<Icons.SearchOutline />} />
 * </PromptInputButton>
 * ```
 */
function PromptInputButton(
  { children, tooltip, className, ...restProps }: PromptInputButtonProps,
  ref: React.Ref<HTMLButtonElement>
) {
  const button = (
    <Button
      ref={ref}
      css={promptInputButtonCSS}
      className={className}
      {...restProps}
    >
      {children}
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  const { content, shortcut, side } = resolveTooltip(tooltip);

  return (
    <TooltipTrigger delay={500} closeDelay={0}>
      {button}
      <Tooltip placement={side}>
        <TooltipArrow />
        {shortcut ? (
          <span css={shortcutCSS}>
            {content}
            <Keyboard>{shortcut}</Keyboard>
          </span>
        ) : (
          content
        )}
      </Tooltip>
    </TooltipTrigger>
  );
}

const _PromptInputButton = forwardRef(PromptInputButton);
_PromptInputButton.displayName = "PromptInputButton";
export { _PromptInputButton as PromptInputButton };
