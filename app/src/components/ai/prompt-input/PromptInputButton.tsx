import { forwardRef } from "react";
import { Button, Keyboard, TooltipTrigger } from "react-aria-components";

import { Tooltip } from "../../core/tooltip";
import { promptInputButtonCSS, promptInputButtonShortcutCSS } from "./styles";
import type { PromptInputButtonProps, PromptInputButtonTooltip } from "./types";

function resolveTooltip(tooltip: PromptInputButtonTooltip) {
  if (typeof tooltip === "string") {
    return { content: tooltip, shortcut: undefined, side: "top" as const };
  }
  return { side: "top" as const, ...tooltip };
}

function PromptInputButtonRoot(
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
        {shortcut ? (
          <span css={promptInputButtonShortcutCSS}>
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

const _PromptInputButton = forwardRef(PromptInputButtonRoot);
_PromptInputButton.displayName = "PromptInputButton";
export { _PromptInputButton as PromptInputButton };
