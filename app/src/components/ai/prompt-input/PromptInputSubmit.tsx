import { Button } from "react-aria-components";

import { Icon, Icons } from "../../core/icon";
import { usePromptInputContext } from "./PromptInputContext";
import { promptInputSubmitCSS } from "./styles";
import type { PromptInputSubmitProps } from "./types";

/**
 * Submit / stop button that adapts its icon and behavior to the current status.
 *
 * - **ready / error** — arrow icon; pressing sends the message.
 * - **streaming, empty input** — stop icon; pressing stops generation.
 * - **streaming, user has typed** — arrow icon; pressing stops generation
 *   then sends the message.
 *
 * Automatically disables when `status` is `"ready"` and the textarea is empty.
 */
export function PromptInputSubmit({
  ref,
  onPress: onStop,
  isDisabled: isDisabledProp,
  "aria-label": ariaLabel,
  className,
}: PromptInputSubmitProps) {
  const context = usePromptInputContext();
  const isStreaming =
    context.status === "submitted" || context.status === "streaming";
  const isEmpty = context.value.trim() === "";

  const computedDisabled =
    isDisabledProp ?? (context.status === "ready" && isEmpty);

  // Send icon overrides the stop icon when user input is entered during streaming.
  const showSend = !isStreaming || !isEmpty;

  const computedAriaLabel =
    ariaLabel ?? (showSend ? "Send message" : "Stop generation");

  const handlePress = () => {
    if (isStreaming) {
      onStop?.();
    }
    if (!isEmpty) {
      context.onSubmit();
    }
  };

  return (
    <Button
      ref={ref}
      css={promptInputSubmitCSS}
      className={className}
      isDisabled={computedDisabled || context.isDisabled}
      onPress={handlePress}
      aria-label={computedAriaLabel}
    >
      <Icon
        svg={showSend ? <Icons.ArrowUpwardOutline /> : <Icons.StopOutline />}
      />
    </Button>
  );
}
