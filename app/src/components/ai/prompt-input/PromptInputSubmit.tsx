import { Button } from "react-aria-components";

import { Icon, Icons } from "../../core/icon";
import { usePromptInputContext } from "./PromptInputContext";
import { promptInputSubmitCSS } from "./styles";
import type { PromptInputSubmitProps } from "./types";

/**
 * Submit / stop button that adapts its icon and behavior to the current status.
 *
 * - **ready / error** — shows an arrow-up icon; pressing calls `context.onSubmit()`.
 * - **submitted / streaming** — shows a stop icon; pressing calls the `onPress` prop.
 *
 * Automatically disables when `status` is `"ready"` and the textarea is empty.
 *
 * @example
 * ```tsx
 * <PromptInputActions>
 *   <PromptInputSubmit onPress={handleStop} />
 * </PromptInputActions>
 * ```
 */
export function PromptInputSubmit({
  ref,
  onPress,
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

  const computedAriaLabel =
    ariaLabel ?? (isStreaming ? "Stop generation" : "Send message");

  const handlePress = () => {
    if (isStreaming) {
      onPress?.();
    } else {
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
        svg={
          isStreaming ? (
            <Icons.StopCircleOutline />
          ) : (
            <Icons.ArrowUpwardOutline />
          )
        }
      />
    </Button>
  );
}
