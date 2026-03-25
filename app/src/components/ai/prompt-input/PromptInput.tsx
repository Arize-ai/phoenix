import type { Ref } from "react";
import { forwardRef, useRef, useState } from "react";

import { PromptInputContext } from "./PromptInputContext";
import { promptInputContainerCSS } from "./styles";
import type { PromptInputProps } from "./types";

/**
 * Root container for the prompt input compound component.
 *
 * Manages internal text state and provides context to all descendants.
 * Compose with `PromptInputBody`, `PromptInputFooter`, and other
 * sub-components to build a complete chat input.
 *
 * @example
 * ```tsx
 * <PromptInput onSubmit={(text) => sendMessage({ text })} status={status}>
 *   <PromptInputBody>
 *     <PromptInputTextarea placeholder="Send a message..." />
 *   </PromptInputBody>
 *   <PromptInputFooter>
 *     <PromptInputTools>
 *       <ModelMenu value={model} onChange={setModel} variant="quiet" />
 *     </PromptInputTools>
 *     <PromptInputActions>
 *       <PromptInputSubmit />
 *     </PromptInputActions>
 *   </PromptInputFooter>
 * </PromptInput>
 * ```
 */
function PromptInput(
  {
    children,
    onSubmit,
    status = "ready",
    isDisabled = false,
    ...restProps
  }: PromptInputProps,
  ref: Ref<HTMLDivElement>
) {
  const [value, setValue] = useState("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleSubmit = () => {
    const trimmed = valueRef.current.trim();
    if (trimmed) {
      onSubmit?.(trimmed);
      setValue("");
    }
  };

  const contextValue = {
    status,
    isDisabled,
    onSubmit: handleSubmit,
    value,
    setValue,
  };

  return (
    <PromptInputContext.Provider value={contextValue}>
      <div
        ref={ref}
        css={promptInputContainerCSS}
        data-status={status}
        {...restProps}
      >
        {children}
      </div>
    </PromptInputContext.Provider>
  );
}

const _PromptInput = forwardRef(PromptInput);
_PromptInput.displayName = "PromptInput";
export { _PromptInput as PromptInput };
