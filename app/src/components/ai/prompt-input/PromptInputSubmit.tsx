import { Button } from "react-aria-components";

import { Icon, Icons } from "../../core/icon";
import { usePromptInputContext } from "./PromptInputContext";
import { promptInputSubmitCSS } from "./styles";
import type { PromptInputSubmitProps } from "./types";

/**
 * Submit / stop button that adapts its icon and behavior to the current status.
 *
 * - **ready / error** — arrow icon; pressing sends the message.
 * - **submitted / streaming** — stop icon; pressing stops generation.
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

  const showSend = !isStreaming;

  const computedAriaLabel =
    ariaLabel ?? (showSend ? "Send message" : "Stop generation");

  const handlePress = () => {
    if (isStreaming) {
      onStop?.();
      return;
    }
    context.onSubmit();
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
      <Icon svg={showSend ? <Icons.ArrowUp /> : <Icons.StopOutline />} />
    </Button>
  );
}
