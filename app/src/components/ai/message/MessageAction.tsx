import { Button, TooltipTrigger } from "react-aria-components";

import { Tooltip, TooltipArrow } from "../../core/tooltip";
import { messageActionCSS } from "./styles";
import type { MessageActionProps, MessageActionTooltip } from "./types";

function resolveTooltip(tooltip: MessageActionTooltip) {
  if (typeof tooltip === "string") {
    return { content: tooltip, position: "top" as const };
  }
  return { position: "top" as const, ...tooltip };
}

/**
 * An icon button intended for use inside {@link MessageActions}. Wraps a
 * react-aria `Button` with consistent sizing and hover/focus styles. When a
 * `tooltip` prop is provided the button is automatically wrapped in a
 * `TooltipTrigger`.
 *
 * @example
 * ```tsx
 * <MessageAction label="Copy" tooltip="Copy to clipboard" onPress={handleCopy}>
 *   <Icon svg={<Icons.DuplicateOutline />} />
 * </MessageAction>
 * ```
 */
export function MessageAction({
  children,
  ref,
  label,
  tooltip,
  className,
  ...restProps
}: MessageActionProps) {
  const button = (
    <Button
      ref={ref}
      css={messageActionCSS}
      className={className}
      aria-label={label}
      {...restProps}
    >
      {children}
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  const { content, position } = resolveTooltip(tooltip);

  return (
    <TooltipTrigger delay={500} closeDelay={0}>
      {button}
      <Tooltip placement={position}>
        <TooltipArrow />
        {content}
      </Tooltip>
    </TooltipTrigger>
  );
}
