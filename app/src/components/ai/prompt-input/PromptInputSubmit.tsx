import { forwardRef } from "react";
import { Button } from "react-aria-components";

import { Icon, Icons } from "../../core/icon";
import { usePromptInputContext } from "./PromptInputContext";
import { promptInputSubmitCSS } from "./styles";
import type { PromptInputSubmitProps } from "./types";

function PromptInputSubmitRoot(
  {
    onPress,
    isDisabled: isDisabledProp,
    "aria-label": ariaLabel,
    className,
  }: PromptInputSubmitProps,
  ref: React.Ref<HTMLButtonElement>
) {
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

const _PromptInputSubmit = forwardRef(PromptInputSubmitRoot);
_PromptInputSubmit.displayName = "PromptInputSubmit";
export { _PromptInputSubmit as PromptInputSubmit };
